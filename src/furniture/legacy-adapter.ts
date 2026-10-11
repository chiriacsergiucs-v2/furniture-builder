import type {Project} from '../engine/types.ts'
import type {StoredPreset} from '../db/database.ts'
import type {ProjectAssembly} from '../assembly/model.ts'
import type {ComponentInstance} from './component-engine.ts'
import {createCabinetComponentTree,createDrawerComponentTree,resolveComponentTree} from './component-engine.ts'

/** Recover only known legacy cabinet/drawer graphs. Missing or invalid data is never discarded. */
function fixedIds(node:ComponentInstance,owner:string,path:string):ComponentInstance{
 return {...node,id:'legacy:'+owner+':'+path,
  children:node.children.map((child,i)=>fixedIds(child,owner,path+'.'+i))}
}
function recover(owner:string,build:()=>ComponentInstance):ComponentInstance|undefined{
 try{
  const tree=fixedIds(build(),owner,'root')
  resolveComponentTree(tree)
  return tree
 }catch{return undefined}
}
function adaptAssembly(a:ProjectAssembly,project:Project):ProjectAssembly{
 if(a.componentTree)return a
 if(a.cabinetSpec){
  const material=project.materials.find(m=>m.id===a.cabinetSpec?.materialId)
  const graph=material&&recover(a.id,()=>createCabinetComponentTree(a.cabinetSpec!,material.thickness))
  return graph?{...a,componentTree:graph}:a
 }
 if(a.drawerSpec){
  const material=project.materials.find(m=>m.id===a.drawerSpec?.materialId)
  const graph=material&&recover(a.id,()=>createDrawerComponentTree(a.drawerSpec!,material.thickness))
  return graph?{...a,componentTree:graph}:a
 }
 return a
}
/** Pure in-memory adapter. The original IndexedDB record is not modified on read. */
export function adaptLegacyProject(project:Project):Project{
 if(!project.assemblies?.length)return project
 return {...project,assemblies:project.assemblies.map(a=>adaptAssembly(a,project))}
}
export function adaptLegacyPreset(preset:StoredPreset):StoredPreset{
 if(preset.componentTree||(!preset.cabinetSpec&&!preset.drawerSpec))return preset
 const thickness=preset.items[0]?.material.thickness
 if(typeof thickness!=='number'||!Number.isSafeInteger(thickness)||thickness<1)return preset
 const graph=preset.cabinetSpec?
  recover(preset.id,()=>createCabinetComponentTree(preset.cabinetSpec!,thickness)):
  recover(preset.id,()=>createDrawerComponentTree(preset.drawerSpec!,thickness))
 return graph?{...preset,componentTree:graph}:preset
}
