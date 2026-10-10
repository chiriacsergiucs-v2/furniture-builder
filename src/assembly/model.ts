import type {Part,Project,Material} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
export type Vec3=[number,number,number]
export interface AssemblyPiece {id:string;partId:string;instanceIndex:number;positionMm:Vec3;rotationDeg:Vec3}
export interface ProjectAssembly {id:string;label:string;pieces:AssemblyPiece[];createdAt:string;updatedAt:string}
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
 const [side,back,front,main]=parts
 const offset=(project.assemblies?.length??0)*500
 const piece=(p:Part,n:number,x:number,z:number,ry=0):AssemblyPiece=>({
  id:crypto.randomUUID(),partId:p.id,instanceIndex:n,
  positionMm:[x+offset,0,z],rotationDeg:[0,ry,0]
 })
 const a=newAssembly(name)
 // 18mm side panels at x±159; 300mm cross panels centered in 336mm outer body.
 // Body 336W x 300D x 250H; main front spans x±200 and is 2mm ahead.
 a.pieces=[piece(side,0,-159,0,90),piece(side,1,159,0,90),
  piece(back,0,0,-141),piece(front,0,0,141),piece(main,0,0,161)]
 return {parts,assembly:a}
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
