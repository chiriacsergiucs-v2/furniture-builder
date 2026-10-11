import type {Project,Part,Material} from '../engine/types.ts'
import type {ProjectAssembly,AssemblyPiece} from '../assembly/model.ts'
import {resolveAssembly} from '../assembly/model.ts'
import {drawerHardware} from './drawer.ts'
import type {CabinetSpec,CompartmentLayout} from './cabinet.ts'

export interface FurnitureSolid {
 instance:AssemblyPiece
 part:Part
 material:Material
}
export interface ManufacturingRow {
 partId:string;label:string;width:number;height:number;thickness:number;quantity:number;materialId:string
}
export interface HardwareRequirement {
 label:string;quantity:number;unit:'pair'|'piece';optional:boolean
}
export interface FurnitureModel {
 assemblyId:string;label:string
 solids:FurnitureSolid[]
 cutlist:ManufacturingRow[]
 hardware:HardwareRequirement[]
 diagnostics:string[]
}
/** Hardware is a requirement schedule; metal fittings are never emitted as sheet-cutting panels. */
const drawersInBay=(b:CompartmentLayout)=>b.content==='drawers'?b.count:0
export function cabinetDrawerCount(s:CabinetSpec):number{
 const own=s.split?drawersInBay(s.split.first)+drawersInBay(s.split.second):(s.drawers??0)
 return own+(s.connected?.drawers??0)
}
function hardwareForAssembly(assembly:ProjectAssembly):HardwareRequirement[]{
 const spec=assembly.drawerSpec??assembly.cabinetSpec?.drawerConfig
 if(!spec)return []
 const copies=assembly.drawerSpec?1:cabinetDrawerCount(assembly.cabinetSpec!)
 if(copies<=0)return []
 return drawerHardware(spec).map(h=>({...h,quantity:h.quantity*copies,
  optional:h.label.includes('(optional')}))
}
/** One normalized view of the saved assembly for 3D, Fusion snapshot and manufacturing counts.
 * This does not certify joint engineering, strength, drilling or hardware suitability.
 */
export function deriveFurnitureModel(project:Project,assembly:ProjectAssembly):FurnitureModel{
 const solids=resolveAssembly(project,assembly)
 const diagnostics:string[]=[]
 if(solids.length!==assembly.pieces.length)
  diagnostics.push('Assembly has unresolved part instances or missing materials.')
 const counts=new Map<string,number>(),keys=new Set<string>()
 for(const {instance,part,material} of solids){
  const key=instance.partId+':'+instance.instanceIndex
  if(keys.has(key))diagnostics.push('Duplicate manufactured part allocation: '+part.label)
  keys.add(key)
  counts.set(part.id,(counts.get(part.id)??0)+1)
  if(part.materialId!==material.id||material.thickness<=0||
   part.width<=0||part.height<=0)diagnostics.push('Invalid panel/material: '+part.label)
  if(!instance.positionMm.every(Number.isFinite)||!instance.rotationDeg.every(Number.isFinite))
   diagnostics.push('Invalid assembly position/rotation: '+part.label)
 }
 const parts=new Map(project.parts.map(part=>[part.id,part]))
 const materials=new Map(project.materials.map(material=>[material.id,material]))
 const cutlist=[...counts.entries()].flatMap(([id,quantity])=>{
  const part=parts.get(id),material=part&&materials.get(part.materialId)
  if(!part||!material){diagnostics.push('Missing cutlist part: '+id);return []}
  if(quantity>part.quantity)diagnostics.push('Assembly requests more panels than the project cutlist: '+part.label)
  return [{partId:part.id,label:part.label,width:part.width,height:part.height,
   thickness:material.thickness,quantity,materialId:material.id}]
 })
 return {assemblyId:assembly.id,label:assembly.label,solids,cutlist,
  hardware:hardwareForAssembly(assembly),diagnostics}
}
