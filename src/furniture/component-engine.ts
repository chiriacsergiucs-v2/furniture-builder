import type {CabinetSpec,CompartmentLayout,CabinetSplit} from './cabinet.ts'
import type {DrawerSpec} from './drawer.ts'

/** Serializable tree. Generator definitions stay in the registry, never in persisted data. */
export interface ParentBinding {
 parentKey:string
 add?:number
 scaledBy?:{parentKey:string;localKey:string}
}
export interface ComponentInstance {
 id:string
 definitionId:string
 definitionVersion:number
 params:Record<string,number>
 bindings?:Record<string,ParentBinding>
 children:ComponentInstance[]
 slot?:string
 template?:{id:string;version:number}
}
/** Shallow boundary prevents Dexie's deep mapped-type recursion. */
export interface StoredComponentTree {
 id:string
 definitionId:string
 definitionVersion:number
 params:Record<string,number>
 bindings?:Record<string,ParentBinding>
 children:unknown[]
 slot?:string
 template?:{id:string;version:number}
}
export type ParameterValues=Record<string,number>
export interface ComponentDefinition {
 id:string
 version:number
 defaults:Readonly<ParameterValues>
 slots?:ReadonlyArray<{id:string;accepts:readonly string[];max:number}>
 derive:(values:Readonly<ParameterValues>)=>ParameterValues
}
export interface ResolvedComponent {
 instance:ComponentInstance
 values:ParameterValues
 children:ResolvedComponent[]
}
const box:ComponentDefinition={
 id:'core/carcass',version:1,defaults:{},
 slots:[{id:'interior.main',accepts:['core/shelf','core/drawer','core/compartment'],max:20}],
 derive:p=>{
  const t=p.thickness,innerWidth=p.width-2*t,innerHeight=p.height-2*t
  const clearHeight=(p.height-(p.shelves+2)*t)/(p.shelves+1)
  const drawerGap=3
  const drawerHeight=p.drawers>0?Math.floor((innerHeight-(p.drawers-1)*drawerGap)/p.drawers):0
  const axis=p.splitAxis===1?'horizontal':'vertical'
  const available=(axis==='vertical'?innerWidth:innerHeight)-t
  const first=Math.floor(available*p.splitRatio/100),second=available-first
  return {
   innerWidth,innerHeight,clearHeight,
   shelfWidth:innerWidth-2*p.sideClear,shelfDepth:p.depth-p.frontClear-p.rearClear,
   shelfX:t+p.sideClear,firstShelfZ:t+clearHeight,shelfPitch:clearHeight+t,
   drawerX:t,drawerFirstZ:t,drawerOpeningWidth:innerWidth,
   drawerOpeningDepth:p.depth-p.rearClear,drawerOpeningHeight:drawerHeight,
   drawerPitch:drawerHeight+drawerGap,
   split0X:t,split0Z:t,split1X:axis==='vertical'?t+first+t:t,
   split1Z:axis==='horizontal'?t+first+t:t,
   split0Width:axis==='vertical'?first:innerWidth,
   split1Width:axis==='vertical'?second:innerWidth,
   split0Height:axis==='horizontal'?first:innerHeight,
   split1Height:axis==='horizontal'?second:innerHeight,
   dividerX:axis==='vertical'?t+first:t,
   dividerZ:axis==='horizontal'?t+first:t
  }
 }
}
const compartment:ComponentDefinition={
 id:'core/compartment',version:1,defaults:{},
 slots:[{id:'contents',accepts:['core/shelf','core/drawer'],max:20}],
 derive:p=>{
  const t=p.thickness
  const clear=(p.height-p.shelves*t)/(p.shelves+1)
  const drawerGap=3
  const dh=p.drawers>0?Math.floor((p.height-(p.drawers-1)*drawerGap)/p.drawers):0
  return {
   shelfX:p.x+p.sideClear,shelfWidth:p.width-2*p.sideClear,
   shelfDepth:p.depth-p.frontClear-p.rearClear,firstShelfZ:p.z+clear,
   shelfPitch:clear+t,
   drawerX:p.x,drawerFirstZ:p.z,drawerOpeningWidth:p.width,
   drawerOpeningHeight:dh,drawerOpeningDepth:p.depth-p.rearClear,
   drawerPitch:dh+drawerGap
  }
 }
}
const shelf:ComponentDefinition={id:'core/shelf',version:1,defaults:{},derive:()=>({})}
const drawerFront:ComponentDefinition={
 id:'core/drawer-front',version:1,defaults:{},
 derive:p=>({
  innerFrontHeight:p.bodyHeight-(p.variant===1?p.pullGap:0),
  appliedFrontWidth:p.openingWidth-2*p.frontGap,
  appliedFrontHeight:p.openingHeight-2*p.frontGap
 })
}
const drawer:ComponentDefinition={
 id:'core/drawer',version:1,defaults:{},
 slots:[{id:'front.main',accepts:['core/drawer-front'],max:1}],
 derive:p=>({
  bodyWidth:p.openingWidth-2*p.sideSpace,
  bodyHeight:p.openingHeight-p.upperClearance,
  bodyDepth:p.underMount===1?p.runnerLength-10:
   p.hasRunners===1?p.runnerLength:p.openingDepth-p.rearClearance
 })
}
const moduleGroup:ComponentDefinition={
 id:'core/module-group',version:1,defaults:{},
 slots:[{id:'modules',accepts:['core/carcass'],max:2}],
 derive:p=>({totalWidth:p.primaryWidth+p.secondaryWidth})
}
const worktopSurface:ComponentDefinition={
 id:'core/surface',version:1,defaults:{},
 derive:p=>({clearHeight:p.height-p.thickness,topArea:p.width*p.depth})
}
export const componentRegistry:ReadonlyMap<string,ComponentDefinition>=new Map(
 [box,compartment,shelf,drawerFront,drawer,moduleGroup,worktopSurface].map(def=>[def.id+'@'+def.version,def] as const)
)
export function getComponentDefinition(id:string,version:number):ComponentDefinition{
 const result=componentRegistry.get(id+'@'+version)
 if(!result)throw Error('Unsupported component definition '+id+'@'+version)
 return result
}
/** Strict one-way dependencies: a child can read its immediate parent's resolved values only. */
export function resolveComponentTree(root:ComponentInstance):ResolvedComponent{
 const seen=new Set<string>()
 let count=0
 const visit=(instance:ComponentInstance,parent?:ParameterValues,depth=0):ResolvedComponent=>{
  if(depth>30||++count>1000)throw Error('Furniture component tree exceeds supported limits')
  if(!instance.id||seen.has(instance.id))throw Error('Duplicate or missing component instance ID')
  seen.add(instance.id)
  const definition=getComponentDefinition(instance.definitionId,instance.definitionVersion)
  if(parent&&!instance.slot)throw Error('Child component is missing an attachment slot')
  const values:ParameterValues={...definition.defaults,...instance.params}
  if(instance.bindings){
   if(!parent)throw Error('Root component cannot depend on a parent')
   for(const [key,binding] of Object.entries(instance.bindings)){
    const base=parent[binding.parentKey]
    if(!Number.isFinite(base))throw Error('Missing parent parameter '+binding.parentKey)
    let value=base+(binding.add??0)
    if(binding.scaledBy){
     const coefficient=parent[binding.scaledBy.parentKey]
     const multiplier=instance.params[binding.scaledBy.localKey]
     if(!Number.isFinite(coefficient)||!Number.isFinite(multiplier))
      throw Error('Invalid binding for '+key)
     value+=coefficient*multiplier
    }
    values[key]=value
   }
  }
  for(const [name,value] of Object.entries(values))
   if(!Number.isFinite(value))throw Error('Invalid component parameter '+name)
  const derived=definition.derive(values)
  for(const [name,value] of Object.entries(derived))
   if(!Number.isFinite(value))throw Error('Invalid derived parameter '+name)
  const scope={...values,...derived}
  const counts=new Map<string,number>()
  const indexed=new Map<string,Set<number>>()
  for(const child of instance.children){
   const slot=definition.slots?.find(s=>s.id===child.slot)
   if(!slot||!slot.accepts.includes(child.definitionId))
    throw Error('Incompatible component '+child.definitionId+' at slot '+(child.slot??'?'))
   const n=(counts.get(slot.id)??0)+1
   if(n>slot.max)throw Error('Attachment slot capacity exceeded: '+slot.id)
   counts.set(slot.id,n)
   const index=child.params.index
   if(Number.isSafeInteger(index)){
    const k=slot.id+':'+child.definitionId
    const used=indexed.get(k)??new Set<number>()
    if(used.has(index))throw Error('Duplicate component index in '+slot.id)
    used.add(index);indexed.set(k,used)
   }
  }
  return {instance,values:scope,children:instance.children.map(c=>visit(c,scope,depth+1))}
 }
 return visit(root)
}
function priorChildren(previous?:StoredComponentTree):StoredComponentTree[]{
 return Array.isArray(previous?.children)?previous.children.filter((entry):entry is StoredComponentTree=>{
  if(!entry||typeof entry!=='object')return false
  const child=entry as Partial<StoredComponentTree>
  return typeof child.id==='string'&&typeof child.definitionId==='string'&&
   typeof child.definitionVersion==='number'&&Boolean(child.params)&&
   typeof child.params==='object'&&Array.isArray(child.children)
 }):[]
}
function previousOf(previous:StoredComponentTree|undefined,kind:string,index:number):StoredComponentTree|undefined{
 return priorChildren(previous).find(c=>c.definitionId===kind&&c.definitionVersion===1&&c.params.index===index)
}
function shelfNode(index:number,scope:'carcass'|'compartment',previous?:StoredComponentTree,
 fraction?:number):ComponentInstance{
 const custom=scope==='carcass'&&fraction!==undefined
 return {
  id:previous?.id??crypto.randomUUID(),
  definitionId:'core/shelf',definitionVersion:1,
  slot:scope==='carcass'?'interior.main':'contents',
  params:{index,...(custom?{fraction:fraction!/100}:{})},
  bindings:{
   x:{parentKey:'shelfX'},y:{parentKey:'frontClear'},
   z:custom?{parentKey:'thickness',scaledBy:{parentKey:'innerHeight',localKey:'fraction'}}:
    {parentKey:'firstShelfZ',scaledBy:{parentKey:'shelfPitch',localKey:'index'}},
   width:{parentKey:'shelfWidth'},depth:{parentKey:'shelfDepth'},
   thickness:{parentKey:'thickness'}
  },
  children:[]
 }
}
export function createDrawerComponentTree(spec:DrawerSpec,thickness:number,previous?:StoredComponentTree):ComponentInstance{
 const compatible=previous?.definitionId==='core/drawer'&&previous.definitionVersion===1
 const sideSpace=spec.runner==='accuride-3832'?13:spec.runner==='blum-movento'?21:
  spec.runner==='none'?1:spec.customSideClearance
 const oldFront=compatible?priorChildren(previous).find(child=>child.definitionId==='core/drawer-front'):undefined
 return {
  id:compatible&&previous?previous.id:crypto.randomUUID(),
  definitionId:'core/drawer',definitionVersion:1,
  template:{id:'drawer-unit',version:1},
  params:{
   openingWidth:spec.openingWidth,openingHeight:spec.openingHeight,
   openingDepth:spec.openingDepth,thickness,sideSpace,runnerLength:spec.runnerLength,
   rearClearance:spec.rearClearance,upperClearance:spec.upperClearance,
   underMount:spec.runner==='blum-movento'?1:0,hasRunners:spec.runner==='none'?0:1
  },
  children:[{
   id:oldFront?.id??crypto.randomUUID(),slot:'front.main',
   definitionId:'core/drawer-front',definitionVersion:1,
   params:{variant:spec.front==='lowered'?1:spec.front==='applied'?2:0,
    frontGap:spec.frontGap,pullGap:spec.pullGap},
   bindings:{
    bodyHeight:{parentKey:'bodyHeight'},
    openingWidth:{parentKey:'openingWidth'},
    openingHeight:{parentKey:'openingHeight'}
   },
   children:[]
  }]
 }
}
function drawerNode(index:number,scope:'carcass'|'compartment',spec:DrawerSpec,t:number,
 previous?:StoredComponentTree):ComponentInstance{
 const node=createDrawerComponentTree(spec,t,previous)
 return {
  ...node,slot:scope==='carcass'?'interior.main':'contents',
  params:{...node.params,index},bindings:{
   x:{parentKey:'drawerX'},y:{parentKey:'frontClear'},
   z:{parentKey:'drawerFirstZ',scaledBy:{parentKey:'drawerPitch',localKey:'index'}},
   openingWidth:{parentKey:'drawerOpeningWidth'},
   openingDepth:{parentKey:'drawerOpeningDepth'},
   openingHeight:{parentKey:'drawerOpeningHeight'}
  }
 }
}
/** Generic immutable repetition, preserving IDs at unchanged logical indices. */
export function repeatComponents(
 parent:ComponentInstance,slot:string,kind:string,count:number,
 factory:(index:number,old?:ComponentInstance)=>ComponentInstance
):ComponentInstance{
 if(!Number.isSafeInteger(count)||count<0||count>20)throw Error('Repeat count must be 0–20')
 const old=parent.children.filter(c=>c.slot===slot&&c.definitionId===kind)
 const others=parent.children.filter(c=>!(c.slot===slot&&c.definitionId===kind))
 const next=Array.from({length:count},(_,i)=>{
  const existing=old.find(c=>c.params.index===i)
  const child=factory(i,existing)
  return {...child,id:existing?.id??child.id,slot,params:{...child.params,index:i}}
 })
 const countKey=kind==='core/shelf'?'shelves':kind==='core/drawer'?'drawers':undefined
 const result={...parent,params:countKey?{...parent.params,[countKey]:count}:parent.params,
  children:[...others,...next]}
 resolveComponentTree(result)
 return result
}
/** Replace one node without rewriting or mutating unrelated siblings. */
export function replaceComponent(root:ComponentInstance,id:string,replacement:ComponentInstance):ComponentInstance{
 let matched=false
 const walk=(node:ComponentInstance):ComponentInstance=>{
  const index=node.children.findIndex(c=>c.id===id)
  if(index>=0){
   matched=true
   const original=node.children[index]
   const children=node.children.map((c,i)=>i===index?{...replacement,slot:original.slot}:c)
   const shelves=children.filter(c=>c.definitionId==='core/shelf').length
   const drawers=children.filter(c=>c.definitionId==='core/drawer').length
   if(shelves&&drawers)throw Error('Mixed shelves and drawers require separate compartments')
   const params={...node.params,...(node.definitionId==='core/carcass'||node.definitionId==='core/compartment'?
    {shelves,drawers}:{})}
   return {...node,params,children}
  }
  return {...node,children:node.children.map(walk)}
 }
 if(root.id===id)throw Error('Cannot replace the furniture root directly')
 const result=walk(root)
 if(!matched)throw Error('Component to replace not found')
 resolveComponentTree(result)
 return result
}
export function insertComponent(root:ComponentInstance,slot:string,child:ComponentInstance):ComponentInstance{
 const definition=getComponentDefinition(root.definitionId,root.definitionVersion)
 const rule=definition.slots?.find(s=>s.id===slot)
 if(!rule||!rule.accepts.includes(child.definitionId))throw Error('Incompatible component '+child.definitionId+' at slot '+slot)
 if(root.children.filter(c=>c.slot===slot).length>=rule.max)throw Error('Attachment slot is full: '+slot)
 const result={...root,children:[...root.children,{...child,slot}]}
 resolveComponentTree(result)
 return result
}
function compartmentNode(index:number,layout:CompartmentLayout,spec:CabinetSpec,t:number,
 previous?:StoredComponentTree):ComponentInstance{
 const count=layout.content==='empty'?0:layout.count
 const result:ComponentInstance={
  id:previous?.id??crypto.randomUUID(),definitionId:'core/compartment',definitionVersion:1,
  slot:'interior.main',params:{index,shelves:layout.content==='shelves'?count:0,
   drawers:layout.content==='drawers'?count:0},
  bindings:{
   x:{parentKey:index===0?'split0X':'split1X'},
   z:{parentKey:index===0?'split0Z':'split1Z'},
   width:{parentKey:index===0?'split0Width':'split1Width'},
   height:{parentKey:index===0?'split0Height':'split1Height'},
   depth:{parentKey:'depth'},thickness:{parentKey:'thickness'},
   sideClear:{parentKey:'sideClear'},frontClear:{parentKey:'frontClear'},
   rearClear:{parentKey:'rearClear'}
  },children:[]
 }
 if(layout.content==='shelves')result.children=Array.from({length:count},(_,i)=>
  shelfNode(i,'compartment',previousOf(previous,'core/shelf',i)))
 if(layout.content==='drawers'){
  if(!spec.drawerConfig)throw Error('Drawer configuration missing for compartment')
  result.children=Array.from({length:count},(_,i)=>
   drawerNode(i,'compartment',spec.drawerConfig!,t,previousOf(previous,'core/drawer',i)))
 }
 return result
}
/** Divide a carcass opening into two independently configured compartment nodes. */
export function splitCompartment(root:ComponentInstance,split:CabinetSplit,
 first:ComponentInstance,second:ComponentInstance):ComponentInstance{
 if(root.definitionId!=='core/carcass')throw Error('Only carcass interiors can currently be split')
 if(!Number.isSafeInteger(split.ratio)||split.ratio<10||split.ratio>90)
  throw Error('Split ratio must be between 10% and 90%')
 if(!['vertical','horizontal'].includes(split.axis))throw Error('Unsupported split axis')
 if(first.definitionId!=='core/compartment'||second.definitionId!=='core/compartment')
  throw Error('Split children must be compartment components')
 const result={...root,params:{...root.params,splitAxis:split.axis==='horizontal'?1:0,splitRatio:split.ratio,
  shelves:0,drawers:0},
  children:[{...first,slot:'interior.main'},{...second,slot:'interior.main'}]}
 resolveComponentTree(result)
 return result
}
/** Connect two actual carcass modules at a non-overlapping right-side docking anchor. */
export function connectModules(first:ComponentInstance,second:ComponentInstance,previous?:StoredComponentTree):ComponentInstance{
 if(first.definitionId!=='core/carcass'||second.definitionId!=='core/carcass')
  throw Error('Connect requires two carcass modules')
 if(first.params.height!==second.params.height||first.params.depth!==second.params.depth||
    first.params.thickness!==second.params.thickness)
  throw Error('Connected modules must share height, depth and material thickness')
 if(first.params.width<=0||second.params.width<=0)
  throw Error('Connected modules require positive widths')
 const result:ComponentInstance={
  id:previous?.definitionId==='core/module-group'?previous.id:crypto.randomUUID(),
  definitionId:'core/module-group',definitionVersion:1,
  template:{id:'cabinet-connected',version:1},
  params:{primaryWidth:first.params.width,secondaryWidth:second.params.width},
  children:[
   {...first,slot:'modules',params:{...first.params,x:0}},
   {...second,slot:'modules',params:{...second.params,x:0},bindings:{x:{parentKey:'primaryWidth'}}}
  ]
 }
 resolveComponentTree(result)
 return result
}
function createSingleCabinetTree(spec:CabinetSpec,t:number,previous?:StoredComponentTree):ComponentInstance{
 const compatible=previous?.definitionId==='core/carcass'&&previous.definitionVersion===1
 const old=compatible?previous:undefined
 const version=spec.templateVersion??1
 if(version!==1)throw Error('Unsupported cabinet template version '+version)
 let root:ComponentInstance={
  id:old?.id??crypto.randomUUID(),definitionId:'core/carcass',definitionVersion:1,
  template:{id:spec.templateId??'cabinet-open',version},
  params:{width:spec.width,height:spec.height,depth:spec.depth,thickness:t,
   shelves:spec.split?0:spec.shelves,drawers:spec.split?0:(spec.drawers??0),
   sideClear:spec.sideClear,frontClear:spec.frontClear,rearClear:spec.rearClear,
   splitAxis:spec.split?.axis==='horizontal'?1:0,splitRatio:spec.split?.ratio??50},
  children:[]
 }
 if(spec.split){
  root=splitCompartment(root,spec.split,
   compartmentNode(0,spec.split.first,spec,t,previousOf(old,'core/compartment',0)),
   compartmentNode(1,spec.split.second,spec,t,previousOf(old,'core/compartment',1)))
 }else if((spec.drawers??0)>0){
  if(!spec.drawerConfig)throw Error('Drawer configuration missing from cabinet')
  root=repeatComponents(root,'interior.main','core/drawer',spec.drawers??0,(index)=>
   drawerNode(index,'carcass',spec.drawerConfig!,t,previousOf(old,'core/drawer',index)))
 }else{
  root=repeatComponents(root,'interior.main','core/shelf',spec.shelves,(index)=>
   shelfNode(index,'carcass',previousOf(old,'core/shelf',index),
    spec.shelfMode==='custom'?spec.shelfPositions?.[index]:undefined))
 }
 return root
}
/** Backwards-compatible legacy cabinet tree is left unchanged unless split/connected is selected. */
export function createCabinetComponentTree(spec:CabinetSpec,thickness:number,previous?:StoredComponentTree):ComponentInstance{
 if(!spec.connected)return createSingleCabinetTree(spec,thickness,previous)
 const existing=previous?.definitionId==='core/module-group'?priorChildren(previous):[]
 const first=createSingleCabinetTree({...spec,connected:undefined},thickness,existing[0])
 const secondSpec:CabinetSpec={...spec,width:spec.connected.width,shelves:spec.connected.shelves,
  drawers:spec.connected.drawers,split:undefined,connected:undefined,shelfMode:'even',
  shelfPositions:undefined,label:spec.label+' · second module'}
 const second=createSingleCabinetTree(secondSpec,thickness,existing[1])
 return connectModules(first,second,previous)
}
