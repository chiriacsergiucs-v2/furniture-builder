import type {CabinetSpec} from './cabinet.ts'
import type {DrawerSpec} from './drawer.ts'

/** Serializable component tree: no functions and no materialized cut pieces. */
export interface ParentBinding {
 parentKey:string
 add?:number
 scaledBy?:{parentKey:string; localKey:string}
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
/** Shallow JSON boundary: Dexie's recursive key-path types cannot traverse a recursive tree type. */
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

const carcass:ComponentDefinition={
 id:'core/carcass',version:1,defaults:{},
 slots:[{id:'interior.main',accepts:['core/shelf','core/drawer'],max:20}],
 derive:p=>{
  const innerWidth=p.width-2*p.thickness
  const clearHeight=(p.height-(p.shelves+2)*p.thickness)/(p.shelves+1)
  return {
   innerWidth,clearHeight,
   shelfWidth:innerWidth-2*p.sideClear,
   shelfDepth:p.depth-p.frontClear-p.rearClear,
   shelfX:p.thickness+p.sideClear,
   firstShelfZ:p.thickness+clearHeight,
   shelfPitch:clearHeight+p.thickness
  }
 }
}
const shelf:ComponentDefinition={
 id:'core/shelf',version:1,defaults:{},derive:()=>({})
}
const drawer:ComponentDefinition={
 id:'core/drawer',version:1,defaults:{},
 derive:p=>({
  bodyWidth:p.openingWidth-2*p.sideSpace,
  bodyHeight:p.openingHeight-p.upperClearance,
  bodyDepth:p.underMount===1?p.runnerLength-10:
   p.hasRunners===1?p.runnerLength:p.openingDepth-p.rearClearance
 })
}
/** Extend with new component definitions, not template-specific sizing copies. */
export const componentRegistry:ReadonlyMap<string,ComponentDefinition>=new Map(
 [carcass,shelf,drawer].map(def=>[def.id+'@'+def.version,def] as const)
)
export function getComponentDefinition(id:string,version:number):ComponentDefinition{
 const def=componentRegistry.get(id+'@'+version)
 if(!def)throw Error('Unsupported component definition '+id+'@'+version)
 return def
}
/** One-way propagation: all child bindings read the already resolved parent scope. */
export function resolveComponentTree(root:ComponentInstance):ResolvedComponent{
 const seen=new Set<string>()
 let count=0
 const visit=(instance:ComponentInstance,parent?:ParameterValues,depth=0):ResolvedComponent=>{
  if(depth>30||++count>1000)throw Error('Furniture component tree exceeds supported limits')
  if(!instance.id||seen.has(instance.id))throw Error('Duplicate or missing component instance ID')
  seen.add(instance.id)
  const def=getComponentDefinition(instance.definitionId,instance.definitionVersion)
  if(parent&&!instance.slot)throw Error('Child component is missing an attachment slot')
  const values:ParameterValues={...def.defaults,...instance.params}
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
  const derived=def.derive(values)
  for(const [name,value] of Object.entries(derived))
   if(!Number.isFinite(value))throw Error('Invalid derived parameter '+name)
  const resolved={...values,...derived}
  const counts=new Map<string,number>()
  for(const child of instance.children){
   const slot=def.slots?.find(s=>s.id===child.slot)
   if(!slot||!slot.accepts.includes(child.definitionId))
    throw Error('Incompatible component '+child.definitionId+' at slot '+(child.slot??'?'))
   counts.set(slot.id,(counts.get(slot.id)??0)+1)
   if(counts.get(slot.id)!>slot.max)throw Error('Attachment slot capacity exceeded: '+slot.id)
  }
  return {instance,values:resolved,children:instance.children.map(child=>visit(child,resolved,depth+1))}
 }
 return visit(root)
}

/** Preserve existing node IDs on edits; different furniture copies receive fresh IDs. */
export function createCabinetComponentTree(spec:CabinetSpec,thickness:number,previous?:StoredComponentTree):ComponentInstance{
 const compatible=previous?.definitionId==='core/carcass'&&previous.definitionVersion===1
 const oldChildren=compatible&&previous&&Array.isArray(previous.children)
  ?previous.children.filter((child):child is StoredComponentTree=>{
   if(!child||typeof child!=='object')return false
   const candidate=child as Partial<StoredComponentTree>
   return typeof candidate.id==='string'&&candidate.definitionId==='core/shelf'&&
    candidate.definitionVersion===1&&Boolean(candidate.params)&&
    typeof candidate.params?.index==='number'
  }):[]
 const templateVersion=spec.templateVersion??1
 if(templateVersion!==1)throw Error('Unsupported cabinet template version '+templateVersion)
 return {
  id:compatible&&previous?previous.id:crypto.randomUUID(),
  definitionId:'core/carcass',definitionVersion:1,
  template:{id:spec.templateId??'cabinet-open',version:templateVersion},
  params:{
   width:spec.width,height:spec.height,depth:spec.depth,thickness,
   shelves:spec.shelves,sideClear:spec.sideClear,
   frontClear:spec.frontClear,rearClear:spec.rearClear
  },
  children:Array.from({length:spec.shelves},(_,index)=>{
   const old=oldChildren.find(child=>child.definitionId==='core/shelf'&&child.params.index===index)
   return {
    id:old?.id??crypto.randomUUID(),
    definitionId:'core/shelf',definitionVersion:1,slot:'interior.main',params:{index},
    bindings:{
     x:{parentKey:'shelfX'},y:{parentKey:'frontClear'},
     z:{parentKey:'firstShelfZ',scaledBy:{parentKey:'shelfPitch',localKey:'index'}},
     width:{parentKey:'shelfWidth'},depth:{parentKey:'shelfDepth'},
     thickness:{parentKey:'thickness'}
    },
    children:[]
   }
  })
 }
}

/** A reusable stand-alone drawer is a component instance; no fixed 40×30 geometry. */
export function createDrawerComponentTree(spec:DrawerSpec,thickness:number,previous?:StoredComponentTree):ComponentInstance{
 const compatible=previous?.definitionId==='core/drawer'&&previous.definitionVersion===1
 const sideSpace=spec.runner==='accuride-3832'?13:spec.runner==='blum-movento'?21:
  spec.runner==='none'?1:spec.customSideClearance
 return {
  id:compatible&&previous?previous.id:crypto.randomUUID(),
  definitionId:'core/drawer',definitionVersion:1,
  template:{id:'drawer-unit',version:1},children:[],
  params:{
   openingWidth:spec.openingWidth,openingHeight:spec.openingHeight,
   openingDepth:spec.openingDepth,thickness,sideSpace,runnerLength:spec.runnerLength,
   rearClearance:spec.rearClearance,upperClearance:spec.upperClearance,
   underMount:spec.runner==='blum-movento'?1:0,
   hasRunners:spec.runner==='none'?0:1
  }
 }
}
/** The insert operation is pure: one incompatible child cannot mutate the parent tree. */
export function insertComponent(root:ComponentInstance,slot:string,child:ComponentInstance):ComponentInstance{
 const parentDef=getComponentDefinition(root.definitionId,root.definitionVersion)
 const spec=parentDef.slots?.find(s=>s.id===slot)
 if(!spec||!spec.accepts.includes(child.definitionId))
  throw Error('Incompatible component '+child.definitionId+' at slot '+slot)
 if(root.children.filter(c=>c.slot===slot).length>=spec.max)throw Error('Attachment slot is full: '+slot)
 if(root.id===child.id||root.children.some(c=>c.id===child.id))throw Error('Duplicate component instance ID')
 const result={...root,children:[...root.children,{...child,slot}]}
 resolveComponentTree(result)
 return result
}
