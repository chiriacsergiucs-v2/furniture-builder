import type {Material,Part,Project,GrainAxis} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
import type {ProjectAssembly,AssemblyPiece,Vec3} from '../assembly/model.ts'
import {presetMaterial,createPreset} from '../presets/presets.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {createCabinetComponentTree,resolveComponentTree} from './component-engine.ts'
import {drawerErrors,drawerPanels} from './drawer.ts'
import {panelCollisionMessages} from './geometry-diagnostics.ts'
import type {DrawerSpec,DrawerRole} from './drawer.ts'

export interface CompartmentLayout {
 content:'empty'|'shelves'|'drawers'
 count:number
}
export interface CabinetSplit {
 axis:'vertical'|'horizontal'
 ratio:number // first compartment gets this percentage of internal space after the divider
 first:CompartmentLayout
 second:CompartmentLayout
}
export interface ConnectedCabinetModule {
 width:number
 shelves:number
 drawers:number
}
 /** Manufacturing dimensions are integer millimetres; assembly centres may be half-mm. */
export interface CabinetSpec {
 label:string; width:number; height:number; depth:number; materialId:string
 shelves:number; sideClear:number; frontClear:number; rearClear:number
 grain:GrainAxis; frontEdge:boolean; templateId?:string; templateVersion?:number
 drawers?:number; drawerConfig?:DrawerSpec
 split?:CabinetSplit; connected?:ConnectedCabinetModule
 shelfMode?:'even'|'custom'; shelfPositions?:number[]
 /** Optional external applied back panel and front leaves. Hardware drilling not represented. */
 backPanel?:boolean; frontDoors?:'none'|'single'|'double'
}
export interface CabinetBox {
 role:'Side panel'|'Top / bottom'|'Shelf'|'Divider'|'Applied back'|'Hinged door'|DrawerRole
 label?:string
 index:number; x:number; y:number; z:number
 dx:number; dy:number; dz:number; cutWidth:number; cutHeight:number; rotationDeg?:Vec3
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
 if(!whole(s.drawers??0)|| (s.drawers??0)<0||(s.drawers??0)>20)e.push('Drawers must be between 0 and 20.')
 if((s.drawers??0)>0&&s.shelves>0)e.push('Choose shelves OR drawers in this undivided compartment.')
 if(s.split){
  if(s.shelves>0||(s.drawers??0)>0)e.push('Split bays use their own shelf and drawer counts.')
  if(!['vertical','horizontal'].includes(s.split.axis)||
    !whole(s.split.ratio)||s.split.ratio<10||s.split.ratio>90)
   e.push('Split direction and percentage must be valid (10–90%).')
  for(const layout of [s.split.first,s.split.second]){
   if(!['empty','shelves','drawers'].includes(layout.content)||!whole(layout.count)||
      layout.count<0||layout.count>20||layout.content==='empty'&&layout.count!==0)
    e.push('Each compartment must have a valid content type and count 0–20.')
  }
 }
 if(s.shelfMode==='custom'&&!s.split&&s.shelves>0){
  const pos=s.shelfPositions??[]
  if(pos.length!==s.shelves||pos.some(n=>!whole(n)||n<5||n>95)||
     pos.some((n,i)=>i>0&&n<=pos[i-1]))
   e.push('Custom shelf positions must be strictly increasing, 5–95%.')
 }
 if(s.connected&&(!whole(s.connected.width)||s.connected.width<=0||
  !whole(s.connected.shelves)||s.connected.shelves<0||s.connected.shelves>20||
  !whole(s.connected.drawers)||s.connected.drawers<0||s.connected.drawers>20||
  s.connected.shelves>0&&s.connected.drawers>0))
  e.push('Connected module needs valid width and either shelves or drawers.')
 if(s.templateVersion!==undefined&&s.templateVersion!==1)e.push('Unsupported cabinet template version.')
 if(s.backPanel!==undefined&&typeof s.backPanel!=='boolean')e.push('Back panel setting must be a boolean.')
 if(s.frontDoors!==undefined&&!['none','single','double'].includes(s.frontDoors))
  e.push('Unsupported door configuration.')
 if(s.frontDoors&&s.frontDoors!=='none'){
  const drawerBays=s.split?[s.split.first,s.split.second].some(b=>b.content==='drawers'&&b.count>0):(s.drawers??0)>0
  if(drawerBays||(s.connected?.drawers??0)>0)
   e.push('Cabinet doors cannot cover drawer fronts; use a dedicated closed shelf compartment.')
  if(s.width<150||s.height<150)e.push('Hinged doors require at least 150 mm width and height.')
 }
 if(material&&whole(material.thickness)&&material.thickness>0&&e.length===0){
  const t=material.thickness
  if(s.width<=2*t+2*s.sideClear)e.push('Width cannot fit the side panels and clearances.')
  if(s.depth<=s.frontClear+s.rearClear)e.push('Depth must exceed front and rear clearances.')
  if(s.shelves>0&&(s.height-(s.shelves+2)*t)/(s.shelves+1)<50)e.push('Each clear compartment must be at least 50 mm tall.')
  if((s.drawers??0)>0){
   const innerHeight=Math.floor((s.height-2*t-((s.drawers??0)-1)*3)/(s.drawers??1))
   if(innerHeight<80)e.push('Each drawer opening must be at least 80 mm high.')
   else if(!s.drawerConfig)e.push('Drawer configuration missing from cabinet.')
   else e.push(...drawerErrors({...s.drawerConfig,openingWidth:s.width-2*t,openingHeight:innerHeight,openingDepth:s.depth-s.rearClear,materialId:material.id},material))
  }
  if(s.shelfMode==='custom'&&!s.split&&s.shelves>0&&s.shelfPositions?.length===s.shelves){
   const innerHeight=s.height-2*t
   const positions=s.shelfPositions.map(percent=>t+innerHeight*percent/100)
   const gaps=[positions[0]-t,...positions.slice(1).map((pos,i)=>pos-positions[i]-t),
    s.height-t-(positions[positions.length-1]+t)]
   if(gaps.some(gap=>gap<50))e.push('Custom shelves require at least 50 mm of clear space between panels.')
  }
  if(s.split&&!e.length){
   const length=(s.split.axis==='vertical'?s.width-2*t:s.height-2*t)-t
   const a=Math.floor(length*s.split.ratio/100),b=length-a
   const bays=[s.split.first,s.split.second]
   for(let i=0;i<2;i++){
    const width=s.split.axis==='vertical'?(i===0?a:b):s.width-2*t
    const height=s.split.axis==='horizontal'?(i===0?a:b):s.height-2*t
    const bay=bays[i]
    if(width<=2*s.sideClear+20||height<50)e.push('Compartment '+(i+1)+' is too small.')
    else if(bay.content==='shelves'&&
      (height-bay.count*t)/(bay.count+1)<50)
      e.push('Compartment '+(i+1)+' shelves need 50 mm clear spacing.')
    else if(bay.content==='drawers'){
     const opening=Math.floor((height-(bay.count-1)*3)/bay.count)
     if(opening<80)e.push('Compartment '+(i+1)+' drawer opening must be at least 80 mm.')
     else if(!s.drawerConfig)e.push('Drawer configuration missing for compartment '+(i+1)+'.')
     else e.push(...drawerErrors({...s.drawerConfig,openingWidth:width,
       openingHeight:opening,openingDepth:s.depth-s.rearClear,materialId:material.id},material)
      .map(issue=>'Compartment '+(i+1)+': '+issue))
    }
   }
  }
  if(s.connected){
   if(s.connected.width<=2*t+2*s.sideClear)e.push('Connected module is too narrow for a carcass.')
   else if(!e.length)e.push(...cabinetErrors({...s,width:s.connected.width,
    shelves:s.connected.shelves,drawers:s.connected.drawers,split:undefined,
    connected:undefined,shelfMode:'even',shelfPositions:undefined},material).map(issue=>'Module 2: '+issue))
  }
 }
 if(e.length===0&&material){
  try{e.push(...panelCollisionMessages(cabinetBoxes(s,material.thickness)))}
  catch(error){e.push(error instanceof Error?error.message:'Could not resolve furniture geometry.')}
 }
 return e
}
export const totalCabinetWidth=(s:CabinetSpec):number=>s.width+(s.connected?.width??0)
export function cabinetBoxes(s:CabinetSpec,t:number):CabinetBox[]{
 const resolved=resolveComponentTree(createCabinetComponentTree(s,t))
 if(resolved.instance.definitionId==='core/module-group'){
  if(!s.connected)throw Error('Connected module configuration missing')
  const left=cabinetBoxes({...s,connected:undefined},t)
  const rightSpec:CabinetSpec={...s,width:s.connected.width,shelves:s.connected.shelves,
   drawers:s.connected.drawers,split:undefined,connected:undefined,shelfMode:'even',
   shelfPositions:undefined}
  const right=cabinetBoxes(rightSpec,t).map(b=>({...b,x:b.x+s.width,
   label:'Module 2 · '+(b.label??b.role)}))
  return [...left,...right]
 }
 const v=resolved.values
 const result:CabinetBox[]=[
  {role:'Side panel',index:0,x:0,y:0,z:0,dx:t,dy:v.depth,dz:v.height,cutWidth:v.height,cutHeight:v.depth},
  {role:'Side panel',index:1,x:v.width-t,y:0,z:0,dx:t,dy:v.depth,dz:v.height,cutWidth:v.height,cutHeight:v.depth},
  {role:'Top / bottom',index:0,x:t,y:0,z:0,dx:v.innerWidth,dy:v.depth,dz:t,cutWidth:v.innerWidth,cutHeight:v.depth},
  {role:'Top / bottom',index:1,x:t,y:0,z:v.height-t,dx:v.innerWidth,dy:v.depth,dz:t,cutWidth:v.innerWidth,cutHeight:v.depth}
 ]
 if(s.split){
  if(s.split.axis==='vertical')result.push({
   role:'Divider',index:0,x:v.dividerX,y:0,z:t,dx:t,dy:v.depth,dz:v.innerHeight,
   cutWidth:v.innerHeight,cutHeight:v.depth,rotationDeg:[0,90,90]
  })
  else result.push({
   role:'Divider',index:0,x:t,y:0,z:v.dividerZ,dx:v.innerWidth,dy:v.depth,dz:t,
   cutWidth:v.innerWidth,cutHeight:v.depth,rotationDeg:[90,0,0]
  })
 }
 const indexes=new Map<string,number>()
 const children=resolved.children.flatMap(child=>child.instance.definitionId==='core/compartment'?
  child.children.map(grand=>({node:grand,bay:Number(child.instance.params.index)+1})):[{node:child,bay:0}])
 for(const {node,bay} of children){
  if(node.instance.definitionId==='core/drawer'){
   if(!s.drawerConfig)throw Error('Drawer specification missing.')
   const b=node.values
   const childSpec:DrawerSpec={...s.drawerConfig,materialId:s.materialId,
    openingWidth:b.openingWidth,openingHeight:b.openingHeight,
    openingDepth:b.openingDepth}
   const m:Material={id:s.materialId,name:'Panel',type:'PAL',thickness:t}
   for(const panel of drawerPanels(childSpec,m)){
    const label=bay?'Bay '+bay+' · '+panel.role:panel.role
    const index=indexes.get(label)??0
    indexes.set(label,index+1)
    result.push({...panel,index,label,x:b.x+panel.x,y:b.y+panel.y,z:b.z+panel.z})
   }
  }else if(node.instance.definitionId==='core/shelf'){
   const b=node.values,label=bay?'Bay '+bay+' · Shelf':'Shelf'
   const index=indexes.get(label)??0
   indexes.set(label,index+1)
   result.push({role:'Shelf',index,label:bay?label:undefined,
    x:b.x,y:b.y,z:b.z,dx:b.width,dy:b.depth,dz:b.thickness,
    cutWidth:b.width,cutHeight:b.depth})
  }else if(node.instance.definitionId==='core/back-panel'||node.instance.definitionId==='core/hinged-door'){
   const b=node.values
   const role=node.instance.definitionId==='core/back-panel'?'Applied back':'Hinged door'
   const label=role==='Hinged door'?(b.leafCount===2?(b.index===0?'Hinged door · left':'Hinged door · right'):'Hinged door · single'):role
   result.push({role,label,index:b.index,x:b.panelX,y:b.panelY,z:b.panelZ,
    dx:b.cutWidth,dy:t,dz:b.cutHeight,cutWidth:b.cutWidth,cutHeight:b.cutHeight,
    rotationDeg:[0,0,0]})
  }else throw Error('Unsupported cabinet child '+node.instance.definitionId)
 }
 return result
}
const edgeFor=(role:CabinetBox['role'],enabled:boolean)=>{
 const abs=emptyAbs()
 if(enabled)abs.bottom=role==='Side panel'?'ABS front':'ABS front'
 return abs
}
const boxName=(b:CabinetBox)=>b.label??b.role
const boxKey=(b:CabinetBox)=>JSON.stringify([boxName(b),b.cutWidth,b.cutHeight])
export function createCabinetParts(s:CabinetSpec,material:Material):Part[]{
 const errors=cabinetErrors(s,material);if(errors.length)throw Error(errors.join(' '))
 const boxes=cabinetBoxes(s,material.thickness)
 const groups=new Map<string,{box:CabinetBox;quantity:number}>()
 for(const b of boxes){
  const key=boxKey(b),previous=groups.get(key)
  groups.set(key,{box:b,quantity:(previous?.quantity??0)+1})
 }
 return [...groups.values()].map(({box,quantity})=>({
  id:crypto.randomUUID(),label:boxName(box),width:box.cutWidth,height:box.cutHeight,
  quantity,materialId:material.id,rotationAllowed:s.grain==='none',
  grain:s.grain,abs:edgeFor(box.role,s.frontEdge),group:s.label
 }))
}

function pieceFor(box:CabinetBox,part:Part,index:number,s:CabinetSpec,offset:number):AssemblyPiece{
 // Three.js/Fusion assembly axes: X width, Y vertical, Z towards cabinet front.
 // CutWidth is aligned with local X; cutHeight with local Y; thickness with local Z.
 const center:Vec3=[
  offset+box.x+box.dx/2-totalCabinetWidth(s)/2,
  box.z+box.dz/2-s.height/2,
  s.depth/2-box.y-box.dy/2
 ]
 return {id:crypto.randomUUID(),partId:part.id,instanceIndex:index,
  positionMm:center,rotationDeg:box.rotationDeg??(box.role==='Side panel'?[0,90,90]:[90,0,0])}
}
export function createCabinetAssemblies(s:CabinetSpec,material:Material,parts:Part[],copies=1,existingCount=0):ProjectAssembly[]{
 const issues=cabinetErrors(s,material);if(issues.length)throw Error(issues.join(' '))
 if(!whole(copies)||copies<1||copies>20)throw Error('Insert between 1 and 20 cabinets.')
 const boxes=cabinetBoxes(s,material.thickness)
 const counts=new Map<string,number>()
 for(const b of boxes)counts.set(boxKey(b),(counts.get(boxKey(b))??0)+1)
 const byKey=new Map(parts.map(p=>[JSON.stringify([p.label,p.width,p.height]),p]))
 for(const [key,count] of counts){
  const part=byKey.get(key)
  if(!part||part.materialId!==material.id||part.quantity<count*copies)
   throw Error('Parts do not match the cabinet specification: '+key)
 }
 const stamp=new Date().toISOString()
 return Array.from({length:copies},(_,copy)=>{
  const offsets=new Map<string,number>()
  const pieces=boxes.map(box=>{
   const key=boxKey(box),part=byKey.get(key)!
   const index=copy*counts.get(key)!+(offsets.get(key)??0)
   offsets.set(key,(offsets.get(key)??0)+1)
   return pieceFor(box,part,index,s,(existingCount+copy)*(totalCabinetWidth(s)+150))
  })
  return {id:crypto.randomUUID(),label:s.label+(copies>1?' #'+(copy+1):''),
   pieces,createdAt:stamp,updatedAt:stamp,cabinetSpec:structuredClone(s),
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
   {...replacement,id:a.id,createdAt:a.createdAt,...(a.sourcePreset?{sourcePreset:structuredClone(a.sourcePreset)}:{})}:a),
  lastResult:undefined
 }
}
