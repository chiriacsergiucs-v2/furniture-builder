import type {Material,Part,Project} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
import type {ProjectAssembly,AssemblyPiece,Vec3} from '../assembly/model.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {createPreset,presetMaterial} from '../presets/presets.ts'
import {resolveComponentTree} from './component-engine.ts'

export type SupportLayout='gables'|'four-supports'|'trestle'|'single-pedestal'|'dual-pedestal'|'console'
export interface SurfaceSpec{
 label:string;templateId:string;templateVersion:1;kind:'desk'|'table'
 materialId:string;width:number;height:number;depth:number;layout:SupportLayout
 inset:number;supportDepth:number
}
export interface SurfacePanel {
 label:string;index:number; x:number;y:number;z:number
 dx:number;dy:number;dz:number;cutWidth:number;cutHeight:number;rotationDeg:Vec3
}
const whole=(n:number)=>Number.isSafeInteger(n)
export function surfaceDefaults(materialId:string):SurfaceSpec{
 return {label:'Panel desk',templateId:'desk-gable',templateVersion:1,kind:'desk',materialId,
  width:1200,height:750,depth:600,layout:'gables',inset:60,supportDepth:130}
}
export function surfaceErrors(s:SurfaceSpec,m?:Material):string[]{
 const errors:string[]=[]
 if(!s.label.trim()||s.label.length>200)errors.push('Enter a furniture name.')
 if(!m||s.materialId!==m.id)errors.push('Select a material from the project.')
 if(!['desk','table'].includes(s.kind)||!['gables','four-supports','trestle','single-pedestal','dual-pedestal','console'].includes(s.layout))
  errors.push('Unsupported structural layout.')
 if(s.templateVersion!==1||!s.templateId)errors.push('Unsupported template version.')
 if(![s.width,s.height,s.depth,s.inset,s.supportDepth].every(whole)||s.width<400||s.height<300||s.depth<250||s.inset<20||s.supportDepth<40)
  errors.push('Width/height/depth and support parameters require valid whole millimetres.')
 if(m&&errors.length===0){
  const t=m.thickness
  if(!whole(t)||t<6||s.height<=t+250||s.width<=2*s.inset+3*t+240||s.depth<=2*s.inset+2*t)
   errors.push('Not enough room for the specified board thickness and support footprint.')
  if(s.supportDepth>s.depth-2*s.inset||s.layout==='trestle'&&s.width<800)
   errors.push('The support panel depth or trestle span exceeds the worktop.')
  if(s.layout==='dual-pedestal'&&s.width<1000)errors.push('Two pedestals need at least 1000 mm overall width.')
 }
 return errors
}
export function surfacePanels(s:SurfaceSpec,m:Material):SurfacePanel[]{
 const errors=surfaceErrors(s,m);if(errors.length)throw Error(errors.join('; '))
 const t=m.thickness,w=s.width,d=s.depth,h=s.height,ins=s.inset
 // The worktop is the full manufactured width and depth, supported below its underside.
 const p:SurfacePanel[]=[]
 const add=(label:string,x:number,y:number,z:number,dx:number,dy:number,dz:number,rotationDeg:Vec3,cutWidth:number,cutHeight:number)=>{
  p.push({label,index:p.filter(q=>q.label===label).length,x,y,z,dx,dy,dz,rotationDeg,cutWidth,cutHeight})
 }
 const topZ=h-t
 add('Worktop',0,0,topZ,w,d,t,[90,0,0],w,d)
 const gable=(name:string,x:number,y:number,depth:number)=>add(name,x,y,0,t,depth,topZ,[0,90,90],topZ,depth)
 const shelf=(name:string,x:number,y:number,z:number,width:number,depth:number)=>add(name,x,y,z,width,depth,t,[90,0,0],width,depth)
 if(s.layout==='gables'){
  gable('Support gable',ins,ins,d-2*ins)
  gable('Support gable',w-ins-t,ins,d-2*ins)
 }else if(s.layout==='four-supports'){
  const sideDepth=s.supportDepth
  for(const x of [ins,w-ins-t])for(const y of [ins,d-ins-sideDepth])
   gable('Panel leg',x,y,sideDepth)
 }else if(s.layout==='trestle'){
  const left=Math.floor(w*.22),right=w-left-t
  gable('Trestle end',left,ins,d-2*ins)
  gable('Trestle end',right,ins,d-2*ins)
  // A long stretcher fits BETWEEN trestles and below the top without overlapping either.
  add('Trestle stretcher',left+t,Math.floor((d-t)/2),Math.floor(topZ*.35),
   right-left-t,t,Math.min(120,Math.floor(topZ*.2)),[0,0,0],right-left-t,Math.min(120,Math.floor(topZ*.2)))
 }else if(s.layout==='console'){
  gable('Side support',ins,ins,d-ins-t)
  gable('Side support',w-ins-t,ins,d-ins-t)
  add('Rear panel',ins+t,d-ins-t,0,w-2*(ins+t),t,topZ,[0,0,0],w-2*(ins+t),topZ)
 }else{
  const pedestalWidth=Math.min(320,Math.floor(w*.29))
  const xLeft=ins,xInner=ins+pedestalWidth-t
  const pedestal=(left:number)=>{
   gable('Pedestal side',left,ins,d-2*ins)
   gable('Pedestal side',left+pedestalWidth-t,ins,d-2*ins)
   shelf('Pedestal shelf',left+t,ins,Math.max(t+60,Math.floor(topZ*.3)),pedestalWidth-2*t,d-2*ins)
  }
  pedestal(xLeft)
  if(s.layout==='dual-pedestal')pedestal(w-ins-pedestalWidth)
  else gable('Far support',w-ins-t,ins,d-2*ins)
 }
 return p
}
const key=(p:SurfacePanel)=>JSON.stringify([p.label,p.cutWidth,p.cutHeight])
export function surfaceParts(s:SurfaceSpec,m:Material):Part[]{
 const boxes=surfacePanels(s,m)
 const groups=new Map<string,{p:SurfacePanel;quantity:number}>()
 for(const p of boxes){const k=key(p),v=groups.get(k);groups.set(k,{p,quantity:(v?.quantity??0)+1})}
 return [...groups.values()].map(({p,quantity})=>({
  id:crypto.randomUUID(),label:p.label,width:p.cutWidth,height:p.cutHeight,
  quantity,materialId:m.id,rotationAllowed:true,grain:'none',abs:emptyAbs(),group:s.label
 }))
}
export function surfaceComponentTree(s:SurfaceSpec,m:Material){
 const root={id:crypto.randomUUID(),definitionId:'core/surface',definitionVersion:1,
  params:{width:s.width,height:s.height,depth:s.depth,thickness:m.thickness,layout:['gables','four-supports','trestle','single-pedestal','dual-pedestal','console'].indexOf(s.layout)},
  children:[],template:{id:s.templateId,version:s.templateVersion}}
 resolveComponentTree(root)
 return root
}
export function surfaceAssemblies(s:SurfaceSpec,m:Material,parts:Part[],copies=1,existingCount=0):ProjectAssembly[]{
 if(!whole(copies)||copies<1||copies>20)throw Error('Insert 1–20 worktop modules.')
 const boxes=surfacePanels(s,m)
 const counts=new Map<string,number>()
 for(const box of boxes)counts.set(key(box),(counts.get(key(box))??0)+1)
 const byKey=new Map(parts.map(part=>[JSON.stringify([part.label,part.width,part.height]),part]))
 for(const [k,n] of counts){
  const part=byKey.get(k);if(!part||part.materialId!==m.id||part.quantity<n*copies)throw Error('Worktop cutlist mismatch: '+k)
 }
 const stamp=new Date().toISOString()
 return Array.from({length:copies},(_,copy)=>{
  const indices=new Map<string,number>()
  const pieces:AssemblyPiece[]=boxes.map(box=>{
   const k=key(box),part=byKey.get(k)!
   const index=copy*counts.get(k)!+(indices.get(k)??0)
   indices.set(k,(indices.get(k)??0)+1)
   return {id:crypto.randomUUID(),partId:part.id,instanceIndex:index,
    positionMm:[(existingCount+copy)*(s.width+150)+box.x+box.dx/2-s.width/2,
     box.z+box.dz/2-s.height/2,s.depth/2-box.y-box.dy/2],
    rotationDeg:box.rotationDeg}
  })
  return {id:crypto.randomUUID(),label:s.label+(copies>1?' #'+(copy+1):''),
   pieces,createdAt:stamp,updatedAt:stamp,surfaceSpec:structuredClone(s),
   componentTree:surfaceComponentTree(s,m)}
 })
}
export function surfaceForProject(p:Project,s:SurfaceSpec){
 const material=p.materials.find(m=>m.id===s.materialId)
 if(!material)throw Error('Material missing from project.')
 const parts=surfaceParts(s,material)
 return {parts,assemblies:surfaceAssemblies(s,material,parts,1,p.assemblies?.length??0)}
}
export function surfacePreset(s:SurfaceSpec,m:Material):CutlistPreset{
 const parts=surfaceParts(s,m)
 const draft=createPreset(s.label,parts.map(p=>({
  label:p.label,width:p.width,height:p.height,quantity:p.quantity,
  material:presetMaterial(m),rotationAllowed:true,grain:'none',abs:emptyAbs()
 })))
 return {...draft,surfaceSpec:structuredClone(s),componentTree:surfaceComponentTree(s,m)}
}
