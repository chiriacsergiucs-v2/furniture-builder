import {createProject} from '../engine/types.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {createDrawerForProject} from '../furniture/drawer.ts'
import PositionedFurniturePreview from './PositionedFurniturePreview.tsx'

/** Named drawer presets display the complete derived assembly, never cut rows laid out as loose rectangles. */
export default function DrawerPresetPreview({preset}:{preset:CutlistPreset}){
 if(!preset.drawerSpec)return null
 const materialSpec=preset.items[0]?.material
 if(!materialSpec)return <p>No material saved for this drawer preset.</p>
 const material={id:'preset-drawer-preview',name:materialSpec.name,type:materialSpec.type,thickness:materialSpec.thickness,finish:materialSpec.finish}
 const base={...createProject(),materials:[material],parts:[],assemblies:[]}
 try{
  const built=createDrawerForProject(base,{...preset.drawerSpec,materialId:material.id})
  return <PositionedFurniturePreview project={{...base,parts:built.parts,assemblies:built.assemblies}} assembly={built.assemblies[0]}/>
 }catch(e){return <p role="alert">{e instanceof Error?e.message:String(e)}</p>}
}
