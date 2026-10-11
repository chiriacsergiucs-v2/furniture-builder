import type {Material,Part,Project,GrainAxis} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
import type {AssemblyPiece,ProjectAssembly,Vec3} from '../assembly/model.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {createPreset,presetMaterial} from '../presets/presets.ts'
import {resolveComponentTree,createDrawerComponentTree} from './component-engine.ts'

export type RunnerProfile='none'|'accuride-3832'|'blum-movento'|'custom'
export type DrawerFront='applied'|'lowered'|'none'
export type DrawerExtension='full'|'partial'
export interface DrawerSpec {
 label:string;materialId:string
 openingWidth:number;openingHeight:number;openingDepth:number
 runner:RunnerProfile;extension:DrawerExtension;runnerLength:number
 customSideClearance:number;upperClearance:number;rearClearance:number
 front:DrawerFront;frontGap:number;pullGap:number
 grain:GrainAxis
}
/** A drawer is sized to the OPENING it fits, not to an assumed carcass thickness. */
export const drawerDefaults=(materialId:string):DrawerSpec=>({
 label:'Configurable drawer',materialId,openingWidth:764,openingHeight:250,openingDepth:450,
 runner:'accuride-3832',extension:'full',runnerLength:400,
 customSideClearance:13,upperClearance:6,rearClearance:20,
 front:'applied',frontGap:2,pullGap:25,grain:'none'
})
export const runnerProfiles=[
 {id:'none',title:'No metal runners',note:'Box geometry only; movement/support must be designed separately'},
 {id:'accuride-3832',title:'Side ball-bearing · Accuride 3832',note:'13 mm each side (within published 12.9–13.2 mm mounting clearance); full extension'},
 {id:'blum-movento',title:'Concealed undermount · Blum MOVENTO',note:'Drawer width = opening − 42 mm; drawer length = nominal runner length − 10 mm; max 16 mm box side thickness'},
 {id:'custom',title:'Custom runner specification',note:'Enter verified clearances and travel type from the chosen hardware datasheet'}
] as const

export function drawerSideSpace(s:DrawerSpec):number{
 if(s.runner==='accuride-3832')return 13
 if(s.runner==='blum-movento')return 21
 if(s.runner==='none')return 1
 return s.customSideClearance
}
export function drawerErrors(s:DrawerSpec,material?:Material):string[]{
 const errors:string[]=[]
 const natural=(n:number,min=0)=>Number.isSafeInteger(n)&&n>=min
 if(!s.label.trim()||s.label.length>200)errors.push('Enter a valid drawer name.')
 if(!material||material.id!==s.materialId)errors.push('Select a valid drawer material.')
 if(![s.openingWidth,s.openingHeight,s.openingDepth,s.runnerLength].every(n=>natural(n,1)))
  errors.push('Opening dimensions and runner length must be positive whole millimetres.')
 if(![s.customSideClearance,s.upperClearance,s.rearClearance,s.frontGap,s.pullGap].every(n=>natural(n)))
  errors.push('Clearances and gaps must be nonnegative whole millimetres.')
 if(!['none','accuride-3832','blum-movento','custom'].includes(s.runner))errors.push('Unsupported drawer runner type.')
 if(!['applied','lowered','none'].includes(s.front))errors.push('Unsupported drawer front type.')
 if(!['full','partial'].includes(s.extension))errors.push('Unsupported extension type.')
 if(s.runner==='blum-movento'&&material&&material.thickness>16)
  errors.push('MOVENTO wood-drawer sides in this profile require a material at most 16 mm thick.')
 if((s.runner==='accuride-3832'||s.runner==='blum-movento')&&s.extension!=='full')
  errors.push('The selected named runner profile is full-extension; use Custom for other travel types.')
 if(s.runner==='custom'&&s.customSideClearance<1)
  errors.push('Custom runners require an explicit positive side clearance from the hardware datasheet.')
 if(s.runner==='none'&&s.extension!=='partial')
  errors.push('Without runners, extension travel is not defined; choose partial (unverified) or a runner.')
 if(material&&errors.length===0){
  const t=material.thickness,side=drawerSideSpace(s),w=s.openingWidth-2*side,h=s.openingHeight-s.upperClearance
  const d=s.runner==='blum-movento'?s.runnerLength-10:s.runner==='none'?s.openingDepth-s.rearClearance:s.runnerLength
  if(w<=2*t+20)errors.push('Drawer opening too narrow for the selected runners and side panels.')
  if(h<=t+40)errors.push('Drawer opening too short for the selected panel thickness.')
  if(d<=2*t+30||d+s.rearClearance>s.openingDepth)
   errors.push('Runner length and rear clearance exceed the available opening depth.')
  if(s.front==='applied'&&(s.openingWidth-2*s.frontGap<=0||s.openingHeight-2*s.frontGap<=0))
   errors.push('Applied drawer front does not fit within the specified front gaps.')
  if(s.front==='lowered'&&(s.pullGap<15||s.pullGap>=h-40))
   errors.push('Lowered pull front requires a finger gap of at least 15 mm and a viable remaining front.')
 }
 return errors
}
export type DrawerRole='Drawer side'|'Drawer back'|'Drawer front'|'Drawer bottom'|'Applied front'
/** Extents use: X=width, Y=depth from front to rear, Z=vertical. All values mm. */
export interface DrawerPanel {
 role:DrawerRole;index:number;x:number;y:number;z:number
 dx:number;dy:number;dz:number;cutWidth:number;cutHeight:number
 rotationDeg:Vec3
}
export function drawerPanels(s:DrawerSpec,material:Material):DrawerPanel[]{
 const problems=drawerErrors(s,material)
 if(problems.length)throw Error(problems.join(' '))
 const root=resolveComponentTree(createDrawerComponentTree(s,material.thickness))
 const {bodyWidth:w,bodyHeight:h,bodyDepth:d,sideSpace:side,thickness:t}=root.values
 const x=side,frontH=s.front==='lowered'?h-s.pullGap:h
 const panels:DrawerPanel[]=[
  {role:'Drawer side',index:0,x,y:0,z:0,dx:t,dy:d,dz:h,cutWidth:d,cutHeight:h,rotationDeg:[0,90,0]},
  {role:'Drawer side',index:1,x:x+w-t,y:0,z:0,dx:t,dy:d,dz:h,cutWidth:d,cutHeight:h,rotationDeg:[0,90,0]},
  {role:'Drawer back',index:0,x:x+t,y:d-t,z:0,dx:w-2*t,dy:t,dz:h,cutWidth:w-2*t,cutHeight:h,rotationDeg:[0,0,0]},
  {role:'Drawer front',index:0,x:x+t,y:0,z:0,dx:w-2*t,dy:t,dz:frontH,cutWidth:w-2*t,cutHeight:frontH,rotationDeg:[0,0,0]},
  {role:'Drawer bottom',index:0,x:x+t,y:t,z:0,dx:w-2*t,dy:d-2*t,dz:t,cutWidth:w-2*t,cutHeight:d-2*t,rotationDeg:[90,0,0]}
 ]
 if(s.front==='applied')panels.push({
  role:'Applied front',index:0,x:s.frontGap,y:-t,z:s.frontGap,
  dx:s.openingWidth-2*s.frontGap,dy:t,dz:s.openingHeight-2*s.frontGap,
  cutWidth:s.openingWidth-2*s.frontGap,cutHeight:s.openingHeight-2*s.frontGap,
  rotationDeg:[0,0,0]
 })
 return panels
}
export function drawerParts(s:DrawerSpec,m:Material):Part[]{
 const panels=drawerPanels(s,m)
 return (['Drawer side','Drawer back','Drawer front','Drawer bottom','Applied front'] as const).flatMap(role=>{
  const group=panels.filter(panel=>panel.role===role)
  if(!group.length)return []
  return [{id:crypto.randomUUID(),label:role,width:group[0].cutWidth,height:group[0].cutHeight,
   quantity:group.length,materialId:m.id,rotationAllowed:s.grain==='none',
   grain:s.grain,abs:emptyAbs(),group:s.label}]
 })
}
export function drawerAssembly(s:DrawerSpec,m:Material,parts:Part[],offset=0,copyIndex=0):ProjectAssembly{
 const panels=drawerPanels(s,m),partByRole=new Map(parts.map(part=>[part.label,part]))
 const now=new Date().toISOString()
 const pieces:AssemblyPiece[]=panels.map(panel=>{
  const part=partByRole.get(panel.role)
  if(!part||part.materialId!==m.id||part.width!==panel.cutWidth||part.height!==panel.cutHeight||
   part.quantity<panels.filter(p=>p.role===panel.role).length)
   throw Error('Drawer cutlist does not match panel geometry: '+panel.role)
  return {id:crypto.randomUUID(),partId:part.id,instanceIndex:panel.index+copyIndex*panels.filter(p=>p.role===panel.role).length,
   positionMm:[offset+panel.x+panel.dx/2-s.openingWidth/2,
    panel.z+panel.dz/2-s.openingHeight/2,
    s.openingDepth/2-panel.y-panel.dy/2],rotationDeg:panel.rotationDeg}
 })
 return {id:crypto.randomUUID(),label:s.label,pieces,createdAt:now,updatedAt:now,
  drawerSpec:structuredClone(s),componentTree:createDrawerComponentTree(s,m.thickness)}
}
export function createDrawerForProject(project:Project,s:DrawerSpec){
 const material=project.materials.find(m=>m.id===s.materialId)
 if(!material)throw Error('Selected drawer material is not part of the project.')
 const parts=drawerParts(s,material)
 return {parts,assemblies:[drawerAssembly(s,material,parts,(project.assemblies?.length??0)*(s.openingWidth+150))]}
}
/** Reuse one cutlist with N independently positioned drawer assemblies. */
export function createDrawerAssemblies(s:DrawerSpec,m:Material,parts:Part[],copies:number,existingCount=0):ProjectAssembly[]{
 if(!Number.isSafeInteger(copies)||copies<1||copies>20)throw Error('Insert between 1 and 20 drawers.')
 return Array.from({length:copies},(_,i)=>drawerAssembly(s,m,parts,(existingCount+i)*(s.openingWidth+150),i))
}
export function createDrawerPreset(s:DrawerSpec,m:Material):CutlistPreset{
 const parts=drawerParts(s,m)
 const p=createPreset(s.label,parts.map(part=>({
  label:part.label,width:part.width,height:part.height,quantity:part.quantity,
  material:presetMaterial(m),rotationAllowed:part.rotationAllowed,grain:part.grain,abs:structuredClone(part.abs)
 })))
 return {...p,drawerSpec:structuredClone(s),componentTree:createDrawerComponentTree(s,m.thickness)}
}
/** Copy-on-write for multiple preset instances sharing one grouped cutlist. */
export function reconfigureDrawer(project:Project,id:string,s:DrawerSpec):Project{
 const prior=project.assemblies?.find(a=>a.id===id)
 if(!prior?.drawerSpec)throw Error('Selected item is not a configurable drawer.')
 const ownIds=new Set(prior.pieces.map(piece=>piece.partId))
 const material=project.materials.find(m=>m.id===s.materialId)
 if(!material)throw Error('Drawer material missing from project.')
 const newParts=drawerParts(s,material),newAssembly=drawerAssembly(s,material,newParts)
 newAssembly.id=id;newAssembly.createdAt=prior.createdAt
 newAssembly.componentTree=createDrawerComponentTree(s,material.thickness,prior.componentTree)
 const otherAssemblies=(project.assemblies??[]).filter(a=>a.id!==id)
 const indexMaps=new Map<string,Map<number,number>>()
 const remainingParts=project.parts.flatMap(part=>{
  if(!ownIds.has(part.id))return [part]
  const remaining=otherAssemblies.flatMap(a=>a.pieces.filter(piece=>piece.partId===part.id))
   .sort((a,b)=>a.instanceIndex-b.instanceIndex)
  const removed=prior.pieces.filter(piece=>piece.partId===part.id).length
  if(remaining.length+removed!==part.quantity)
   throw Error('Drawer part '+part.label+' contains unallocated pieces; cannot reconfigure safely.')
  const mapping=new Map(remaining.map((piece,i)=>[piece.instanceIndex,i]))
  if(mapping.size!==remaining.length)throw Error('Duplicate drawer part allocations')
  indexMaps.set(part.id,mapping)
  return remaining.length?[{...part,quantity:remaining.length}]:[]
 })
 const assemblies=(project.assemblies??[]).map(a=>{
  if(a.id===id)return newAssembly
  return {...a,pieces:a.pieces.map(piece=>{
   const mapped=indexMaps.get(piece.partId)?.get(piece.instanceIndex)
   return mapped===undefined?piece:{...piece,instanceIndex:mapped}
  })}
 })
 return {...project,parts:[...remainingParts,...newParts],assemblies,lastResult:undefined}
}
