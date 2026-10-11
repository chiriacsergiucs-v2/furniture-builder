import {useEffect,useMemo,useState} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {BoxGeometry,EdgesGeometry,MathUtils} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {CutlistPreset,PresetItem} from '../presets/presets.ts'
import {DRAWER_PRESET_ID} from '../assembly/model.ts'

type Box={id:string;name:string;materialType:PresetItem['material']['type'];size:[number,number,number];pos:[number,number,number];rot:[number,number,number]}
const colors={PAL:'#b69a7c',MDF:'#778bb1',plywood:'#d2a36e',custom:'#75a7a1'}
function layout(p:CutlistPreset,itemIndex?:number):Box[]{
 const selected=itemIndex===undefined?p.items:[p.items[itemIndex]].filter(Boolean)
 if(itemIndex===undefined&&p.id===DRAWER_PRESET_ID&&p.items.length===4){
  // Canonical 40 x 30 drawer: two separate sides, back, inner and main front.
  const positions:[number,number,number,number][]= [[-159,0,0,90],[159,0,0,90],[0,0,-141,0],[0,0,141,0],[0,0,161,0]]
  return [p.items[0],p.items[0],p.items[1],p.items[2],p.items[3]].map((item,i)=>({
   id:String(i),name:item.label+(i<2?' #'+(i+1):''),materialType:item.material.type,
   size:[item.width/1000,item.height/1000,item.material.thickness/1000],
   pos:[positions[i][0]/1000,0,positions[i][2]/1000],rot:[0,MathUtils.degToRad(positions[i][3]),0]
  }))
 }
 const boxes:Box[]=[]
 const cols=3,gap=.09
 let cursor=0
 for(let row=0;row<selected.length;row+=cols){
  const group=selected.slice(row,row+cols)
  let x=-group.reduce((sum,i)=>sum+i.width/1000+gap,0)/2+gap/2
  const h=Math.max(...group.map(i=>i.height/1000))
  for(const item of group){
   const w=item.width/1000
   boxes.push({id:String(row+group.indexOf(item)),name:item.label,materialType:item.material.type,
    size:[w,item.height/1000,item.material.thickness/1000],pos:[x+w/2,cursor-item.height/2000,0],rot:[0,0,0]})
   x+=w+gap
  }
  cursor-=h+gap
 }
 return boxes
}
function Controls({focus}:{focus:[number,number,number]}){
 const {camera,gl,invalidate}=useThree()
 useEffect(()=>{
  const c=new OrbitControls(camera,gl.domElement)
  c.target.set(...focus);c.minDistance=.15;c.maxDistance=30
  const change=()=>invalidate()
  c.addEventListener('change',change);c.update()
  return()=>{c.removeEventListener('change',change);c.dispose()}
 },[camera,gl,invalidate,focus[0],focus[1],focus[2]])
 return null
}
function Solid({panel,selected,onClick}:{panel:Box;selected:boolean;onClick:()=>void}){
 const geometry=useMemo(()=>new BoxGeometry(...panel.size),[panel.size])
 const edges=useMemo(()=>new EdgesGeometry(geometry),[geometry])
 useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges])
 return <group position={panel.pos} rotation={panel.rot}>
  <mesh geometry={geometry} onClick={e=>{e.stopPropagation();onClick()}}>
   <meshStandardMaterial color={selected?'#ffbb65':colors[panel.materialType]} roughness={.55}/>
  </mesh>
  <lineSegments geometry={edges}><lineBasicMaterial color="#28435a"/></lineSegments>
 </group>
}
function canUseWebgl(){try{return Boolean(document.createElement('canvas').getContext('webgl2'))}catch{return false}}
export default function Preset3DViewer({preset,itemIndex}:{preset:CutlistPreset;itemIndex?:number}){
 const panels=useMemo(()=>layout(preset,itemIndex),[preset,itemIndex])
 const [supported]=useState(canUseWebgl)
 const [selectedId,setSelectedId]=useState(panels[0]?.id??'')
 const focus=useMemo((): [number,number,number]=>{
  if(!panels.length)return [0,0,0]
  return [panels.reduce((s,p)=>s+p.pos[0],0)/panels.length,
    panels.reduce((s,p)=>s+p.pos[1],0)/panels.length,0]
 },[panels])
 const distance=Math.max(1.2,...panels.map(p=>Math.max(p.size[0],p.size[1])*.9))+Math.max(0,panels.length-1)*.15
 const selected=panels.find(p=>p.id===selectedId)
 return <div className="preset-3d-view" role="region" aria-label={itemIndex===undefined?'Preset 3D preview':'Item 3D preview'}>
  {supported?<div className="panel3d-canvas preset-3d-canvas" data-testid="preset-3d-canvas">
   <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[focus[0]+distance*.6,focus[1]+distance*.45,Math.max(1.4,distance*1.65)],fov:43}}>
    <color attach="background" args={['#eaf1f6']}/>
    <ambientLight intensity={1.6}/><directionalLight position={[4,6,8]} intensity={2.4}/>
    <Controls focus={focus}/>
    {panels.map(p=><Solid key={p.id} panel={p} selected={p.id===selectedId} onClick={()=>setSelectedId(p.id)}/>)}
   </Canvas>
  </div>:<p role="status">WebGL2 unavailable. The dimensions and part list remain accessible.</p>}
  <p className="muted">{itemIndex===undefined&&preset.id===DRAWER_PRESET_ID?'Positioned starter drawer assembly.':'Panel geometry preview; positioning is illustrative, not a validated assembly.'} Drag to orbit, pinch/scroll to zoom.</p>
  {selected&&<p className="muted">Selected: {selected.name} · {Math.round(selected.size[0]*1000)} × {Math.round(selected.size[1]*1000)} × {Math.round(selected.size[2]*1000)} mm</p>}
 </div>
}
