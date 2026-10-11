import type {Material,Part,Project,GrainAxis} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
import type {ProjectAssembly,AssemblyPiece,Vec3} from '../assembly/model.ts'
import {presetMaterial,createPreset} from '../presets/presets.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {createCabinetComponentTree,resolveComponentTree} from './component-engine.ts'

/** Manufacturing dimensions are integer millimetres; assembly centres may be half-mm. */
export interface CabinetSpec {
 label:string; width:number; height:number; depth:number; materialId:string
 shelves:number; sideClear:number; frontClear:number; rearClear:number
 grain:GrainAxis; frontEdge:boolean; templateId?:string; templateVersion?:number
}
export interface CabinetBox {
 role:'Side panel'|'Top / bottom'|'Shelf'
 index:number; x:number; y:number; z:number
 dx:number; dy:number; dz:number; cutWidth:number; cutHeight:number
}
export const cabinetDefaults=(materialId:string):CabinetSpec=>({
 label:'Open cabinet',width:800,height:900,depth:350,materialId,shelves:2,
 sideClear:0,frontClear:0,rearClear:0,grain:'none',frontEdge:false,templateId:'cabinet-open',templateVersion:1
})
const whole=(x:number)=>Number.isSafeInteger(x)
export function cabinetErrors(s:CabinetSpec,material?:Material):string[]{
 const e:string[]=[]
 if(!s.label.trim()||s.label.length>200)e.push('Enter a cabinet name (max 200 characters).')
 if(!material||material.id!==s.materialId)e.push('Select a valid project material.')
 if(![s.width,s.height,s.depth].every(n=>whole(n)&&n>0))e.push('Width, height and depth must be positive whole millimetres.')
 if(![s.sideClear,s.frontClear,s.rearClear].every(n=>whole(n)&&n>=0))e.push('Clearances must be nonnegative whole millimetres.')
 if(!whole(s.shelves)||s.shelves<0||s.shelves>20)e.push('Shelves must be between 0 and 20.')
 if(s.templateVersion!==undefined&&s.templateVersion!==1)e.push('Unsupported cabinet template version.')
 if(material&&whole(material.thickness)&&material.thickness>0&&e.length===0){
  const t=material.thickness
  if(s.width<=2*t+2*s.sideClear)e.push('Width cannot fit the side panels and clearances.')
  if(s.depth<=s.frontClear+s.rearClear)e.push('Depth must exceed front and rear clearances.')
  if((s.height-(s.shelves+2)*t)/(s.shelves+1)<50)e.push('Each clear compartment must be at least 50 mm tall.')
 }
 return e
}
export function cabinetBoxes(s:CabinetSpec,t:number):CabinetBox[]{
 const resolved=resolveComponentTree(createCabinetComponentTree(s,t))
 const v=resolved.values
 const result:CabinetBox[]=[
  {role:'Side panel',index:0,x:0,y:0,z:0,dx:v.thickness,dy:v.depth,dz:v.height,cutWidth:v.height,cutHeight:v.depth},
  {role:'Side panel',index:1,x:v.width-v.thickness,y:0,z:0,dx:v.thickness,dy:v.depth,dz:v.height,cutWidth:v.height,cutHeight:v.depth},
  {role:'Top / bottom',index:0,x:v.thickness,y:0,z:0,dx:v.innerWidth,dy:v.depth,dz:v.thickness,cutWidth:v.innerWidth,cutHeight:v.depth},
  {role:'Top / bottom',index:1,x:v.thickness,y:0,z:v.height-v.thickness,dx:v.innerWidth,dy:v.depth,dz:v.thickness,cutWidth:v.innerWidth,cutHeight:v.depth}
 ]
 for(const child of resolved.children){
  if(child.instance.definitionId!=='core/shelf')throw Error('Unsupported cabinet child '+child.instance.definitionId)
  const b=child.values
  result.push({
   role:'Shelf',index:b.index,x:b.x,y:b.y,z:b.z,
   dx:b.width,dy:b.depth,dz:b.thickness,
   cutWidth:b.width,cutHeight:b.depth
  })
 }
 return result
}
const edgeFor=(role:CabinetBox['role'],enabled:boolean)=>{
 const abs=emptyAbs()
 if(enabled)abs.bottom=role==='Side panel'?'ABS front':'ABS front'
 return abs
}
export function createCabinetParts(s:CabinetSpec,material:Material):Part[]{
 const errors=cabinetErrors(s,material);if(errors.length)throw Error(errors.join(' '))
 const b=cabinetBoxes(s,material.thickness)
 return (['Side panel','Top / bottom','Shelf'] as const).flatMap(role=>{
  const matching=b.filter(x=>x.role===role)
  if(!matching.length)return []
  return [{id:crypto.randomUUID(),label:role,width:matching[0].cutWidth,height:matching[0].cutHeight,
   quantity:matching.length,materialId:material.id,rotationAllowed:s.grain==='none',
   grain:s.grain,abs:edgeFor(role,s.frontEdge),group:s.label}]
 })
}
function pieceFor(box:CabinetBox,part:Part,index:number,s:CabinetSpec,offset:number):AssemblyPiece{
 // Three.js/Fusion assembly axes: X width, Y vertical, Z towards cabinet front.
 // CutWidth is aligned with local X; cutHeight with local Y; thickness with local Z.
 const center:Vec3=[
  offset+box.x+box.dx/2-s.width/2,
  box.z+box.dz/2-s.height/2,
  s.depth/2-box.y-box.dy/2
 ]
 return {id:crypto.randomUUID(),partId:part.id,instanceIndex:index,
  positionMm:center,rotationDeg:box.role==='Side panel'?[0,90,90]:[90,0,0]}
}
export function createCabinetAssemblies(s:CabinetSpec,material:Material,parts:Part[],copies=1,existingCount=0):ProjectAssembly[]{
 const errors=cabinetErrors(s,material);if(errors.length)throw Error(errors.join(' '))
 if(!whole(copies)||copies<1||copies>20)throw Error('Insert between 1 and 20 cabinets.')
 const boxes=cabinetBoxes(s,material.thickness)
 const byRole=new Map(parts.map(p=>[p.label,p]))
 const stamp=new Date().toISOString()
 for(const role of new Set(boxes.map(b=>b.role))){
  const part=byRole.get(role),perCabinet=boxes.filter(b=>b.role===role).length
  if(!part||part.quantity<perCabinet*copies||part.width!==boxes.find(b=>b.role===role)?.cutWidth||
   part.height!==boxes.find(b=>b.role===role)?.cutHeight||part.materialId!==material.id){
   throw Error('Parts do not match the cabinet specification: '+role)
  }
 }
 return Array.from({length:copies},(_,copy)=>{
  const id=crypto.randomUUID(),offset=(existingCount+copy)*(s.width+150)
  const pieces=boxes.map(box=>{
   const part=byRole.get(box.role)!
   return pieceFor(box,part,copy*boxes.filter(b=>b.role===box.role).length+box.index,s,offset)
  })
  return {id,label:s.label+(copies>1?' #'+(copy+1):''),pieces,
   createdAt:stamp,updatedAt:stamp,cabinetSpec:structuredClone(s),
   componentTree:createCabinetComponentTree(s,material.thickness)}
 })
}
export function createCabinetForProject(project:Project,s:CabinetSpec):{parts:Part[];assemblies:ProjectAssembly[]}{
 const material=project.materials.find(m=>m.id===s.materialId)
 if(!material)throw Error('Selected material does not exist in the project.')
 const parts=createCabinetParts(s,material)
 const assemblies=createCabinetAssemblies(s,material,parts,1,project.assemblies?.length??0)
 return {parts,assemblies}
}
export function createCabinetPreset(s:CabinetSpec,material:Material):CutlistPreset{
 const parts=createCabinetParts(s,material)
 const preset=createPreset(s.label,parts.map(p=>({
  label:p.label,width:p.width,height:p.height,quantity:p.quantity,
  material:presetMaterial(material),rotationAllowed:p.rotationAllowed,
  grain:p.grain,abs:structuredClone(p.abs)
 })))
 return {...preset,cabinetSpec:structuredClone(s),componentTree:createCabinetComponentTree(s,material.thickness)}
}

/** Replace one managed cabinet without mutating other assemblies or project items. */
export function reconfigureCabinet(project:Project,assemblyId:string,spec:CabinetSpec):Project{
 const old=project.assemblies?.find(a=>a.id===assemblyId)
 if(!old?.cabinetSpec)throw Error('This assembly is not a configurable cabinet.')
 const ownPartIds=new Set(old.pieces.map(piece=>piece.partId))
 const otherAssemblies=(project.assemblies??[]).filter(a=>a.id!==assemblyId)
 if(otherAssemblies.some(a=>a.pieces.some(piece=>ownPartIds.has(piece.partId))))
  throw Error('Cabinet parts are shared by another assembly; duplicate the cabinet before editing.')
 const material=project.materials.find(m=>m.id===spec.materialId)
 if(!material)throw Error('Selected material is not available.')
 const parts=createCabinetParts(spec,material)
 const index=(project.assemblies??[]).findIndex(a=>a.id===assemblyId)
 const replacement=createCabinetAssemblies(spec,material,parts,1,index)[0]
 replacement.componentTree=createCabinetComponentTree(spec,material.thickness,old.componentTree)
 return {...project,
  parts:[...project.parts.filter(part=>!ownPartIds.has(part.id)),...parts],
  assemblies:(project.assemblies??[]).map(a=>a.id===assemblyId?
   {...replacement,id:a.id,createdAt:a.createdAt}:a),
  lastResult:undefined
 }
}
