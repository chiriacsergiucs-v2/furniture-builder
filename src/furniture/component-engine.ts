import type {CabinetSpec} from './cabinet.ts'

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
 template?:{id:string;version:number}
}
export type ParameterValues=Record<string,number>
export interface ComponentDefinition {
 id:string
 version:number
 defaults:Readonly<ParameterValues>
 derive:(values:Readonly<ParameterValues>)=>ParameterValues
}
export interface ResolvedComponent {
 instance:ComponentInstance
 values:ParameterValues
 children:ResolvedComponent[]
}

const carcass:ComponentDefinition={
 id:'core/carcass',version:1,defaults:{},
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
/** Extend with new component definitions, not template-specific sizing copies. */
export const componentRegistry:ReadonlyMap<string,ComponentDefinition>=new Map(
 [carcass,shelf].map(def=>[def.id+'@'+def.version,def] as const)
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
  return {instance,values:resolved,children:instance.children.map(child=>visit(child,resolved,depth+1))}
 }
 return visit(root)
}

/** Preserve existing node IDs on edits; different furniture copies receive fresh IDs. */
export function createCabinetComponentTree(spec:CabinetSpec,thickness:number,previous?:ComponentInstance):ComponentInstance{
 const compatible=previous?.definitionId==='core/carcass'&&previous.definitionVersion===1
 const oldChildren=compatible&&previous&&Array.isArray(previous.children)?previous.children:[]
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
    definitionId:'core/shelf',definitionVersion:1,params:{index},
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
