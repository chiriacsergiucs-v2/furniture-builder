import {useMemo} from 'react'
import type {Material} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {CabinetBox,CabinetSpec} from '../furniture/cabinet.ts'
import {createCabinetForProject} from '../furniture/cabinet.ts'
import PositionedFurniturePreview from './PositionedFurniturePreview.tsx'

/** One assembled 3D path for both standalone cabinets and saved project furniture.
 * The preview material reproduces the chosen panel thickness; visual finishes are deferred.
 */
export default function CabinetPreview({spec,boxes}:{spec:CabinetSpec;boxes:CabinetBox[]}){
 const thickness=boxes.find(b=>b.role==='Side panel')?.dx
 const preview=useMemo(()=>{
  if(!thickness)return null
  const material:Material={id:spec.materialId,name:'Preview panel',type:'PAL',thickness}
  const project=createProject()
  const base={...project,materials:[material],parts:[],assemblies:[]}
  const generated=createCabinetForProject(base,spec)
  return {project:{...base,parts:generated.parts,assemblies:generated.assemblies},
   assembly:generated.assemblies[0]}
 },[spec,thickness])
 if(!preview)return <div className="cabinet-no-webgl">Unable to preview cabinet without valid panel thickness.</div>
 return <PositionedFurniturePreview project={preview.project} assembly={preview.assembly}/>
}
