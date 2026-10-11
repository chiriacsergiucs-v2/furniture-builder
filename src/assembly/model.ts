import type {Part,Project,Material} from '../engine/types.ts'
import type {CabinetSpec} from '../furniture/cabinet.ts'
import type {ComponentInstance} from '../furniture/component-engine.ts'
import {emptyAbs} from '../engine/types.ts'
export type Vec3=[number,number,number]
export interface AssemblyPiece {id:string;partId:string;instanceIndex:number;positionMm:Vec3;rotationDeg:Vec3}
export interface ProjectAssembly {id:string;label:string;pieces:AssemblyPiece[];cabinetSpec?:CabinetSpec;componentTree?:ComponentInstance;createdAt:string;updatedAt:string}
export const DRAWER_CATEGORY_ID='starter-drawers'
export const DRAWER_PRESET_ID='starter-drawer-40x30-preset-v1'
export const DRAWER_KIT_ID='starter-drawer-40x30-kit-v1'
export function newAssembly(label:string):ProjectAssembly{
 const date=new Date().toISOString();return {id:crypto.randomUUID(),label,pieces:[],createdAt:date,updatedAt:date}
}
export function createDrawer40x30(project:Project):{parts:Part[];assembly:ProjectAssembly}{
 const material=project.materials.find(m=>m.type==='PAL'&&m.thickness===18)
 if(!material)throw Error('40 × 30 cm drawer requires PAL 18 mm. Add compatible material first.')
 const name='40 × 30 cm Drawer'
 const part=(label:string,width:number,height:number,quantity:number):Part=>({
  id:crypto.randomUUID(),label,width,height,quantity,materialId:material.id,
  rotationAllowed:true,grain:'none',abs:emptyAbs(),group:name
 })
 const parts=[part('Drawer side',300,250,2),part('Drawer back',300,250,1),
  part('Drawer front (inner)',300,250,1),part('Front Main',400,300,1)]
 const assembly=createPositionedDrawers(parts,1,project.assemblies?.length??0)[0]
 return {parts,assembly}
}
export function createPositionedDrawers(parts:Part[],copies:number,existingAssemblyCount=0):ProjectAssembly[]{
 if(!Number.isSafeInteger(copies)||copies<1||copies>20)throw Error('Positioned drawer presets support 1–20 sets per insertion.')
 const expected:[string,number,number,number][]=[
  ['Drawer side',300,250,2],['Drawer back',300,250,1],
  ['Drawer front (inner)',300,250,1],['Front Main',400,300,1]
 ]
 if(parts.length!==4||expected.some(([label,w,h,n])=>!parts.some(p=>p.label===label&&p.width===w&&p.height===h&&p.quantity===n*copies)))
  throw Error('The starter drawer was customized. Restore its original dimensions to create a positioned assembly, or place its parts manually.')
 const [side,back,front,main]=expected.map(([label])=>parts.find(p=>p.label===label)!)
 return Array.from({length:copies},(_,i)=>{
  const offset=(existingAssemblyCount+i)*500
  const piece=(p:Part,n:number,x:number,z:number,ry=0):AssemblyPiece=>({
   id:crypto.randomUUID(),partId:p.id,instanceIndex:n,
   positionMm:[offset+x,0,z],rotationDeg:[0,ry,0]
  })
  const a=newAssembly('40 × 30 cm Drawer'+(copies>1?' #'+(i+1):''))
  // A 336 x 300 x 250 mm body with 18 mm sides and 2 mm front reveal.
  a.pieces=[
   piece(side,i*2,-159,0,90),piece(side,i*2+1,159,0,90),
   piece(back,i,0,-141),piece(front,i,0,141),piece(main,i,0,161)
  ]
  return a
 })
}
export function addPartInstances(a:ProjectAssembly,p:Part):ProjectAssembly{
 const allocated=new Set(a.pieces.filter(x=>x.partId===p.id).map(x=>x.instanceIndex))
 const next=[...a.pieces]
 for(let i=0;i<p.quantity;i++)if(!allocated.has(i))next.push({
  id:crypto.randomUUID(),partId:p.id,instanceIndex:i,
  positionMm:[i*35,0,0],rotationDeg:[0,0,0]
 })
 return {...a,pieces:next,updatedAt:new Date().toISOString()}
}
export function resolveAssembly(project:Project,a:ProjectAssembly):{instance:AssemblyPiece;part:Part;material:Material}[]{
 const parts=new Map(project.parts.map(p=>[p.id,p]))
 const materials=new Map(project.materials.map(m=>[m.id,m]))
 return a.pieces.flatMap(instance=>{
  const part=parts.get(instance.partId),material=part&&materials.get(part.materialId)
  return part&&material&&instance.instanceIndex<part.quantity?[{instance,part,material}]:[]
 })
}
