import {useEffect,useMemo,useState} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {BoxGeometry,EdgesGeometry} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {Project} from '../engine/types.ts'
import {layoutPreviewParts} from './panel3d-layout.ts'
import type {PreviewPanel} from './panel3d-layout.ts'

const palette:Record<PreviewPanel['materialType'],string>={PAL:'#9aa7b4',MDF:'#526f92',plywood:'#bda27d',custom:'#7ba39b'}
function OrbitController(){
 const {camera,gl,invalidate}=useThree()
 useEffect(()=>{
  const orbit=new OrbitControls(camera,gl.domElement)
  orbit.enableDamping=false
  orbit.enablePan=true
  orbit.minDistance=0.3
  orbit.maxDistance=80
  orbit.target.set(0,0,0)
  const changed=()=>invalidate()
  orbit.addEventListener('change',changed)
  orbit.update()
  return ()=>{orbit.removeEventListener('change',changed);orbit.dispose()}
 },[camera,gl,invalidate])
 return null
}
function PanelMesh({panel,selected,onSelect}:{panel:PreviewPanel;selected:boolean;onSelect:(id:string)=>void}){
 const geometry=useMemo(()=>new BoxGeometry(...panel.size),[panel.size])
 const edges=useMemo(()=>new EdgesGeometry(geometry),[geometry])
 useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges])
 return <group position={panel.position}>
  <mesh geometry={geometry} onClick={e=>{e.stopPropagation();onSelect(panel.id)}} onPointerMissed={()=>undefined}>
   <meshStandardMaterial color={selected?'#f9b45d':palette[panel.materialType]} metalness={0.03} roughness={0.55}/>
  </mesh>
  <lineSegments geometry={edges}><lineBasicMaterial color={selected?'#7e4011':'#1b354e'}/></lineSegments>
 </group>
}
function webglSupported(){
 try{const canvas=document.createElement('canvas');return Boolean(canvas.getContext('webgl2'))}catch{return false}
}
export default function Panel3DPreview({project}:{project:Project}){
 const layout=useMemo(()=>layoutPreviewParts(project.parts,project.materials),[project.parts,project.materials])
 const [selected,setSelected]=useState('')
 const [webgl]=useState(webglSupported)
 const active=layout.panels.find(p=>p.id===selected)
 const distance=Math.max(2.5,Math.max(layout.width,layout.height)*1.35+1.8)
 return <div className="panel3d-preview" role="region" aria-label="3D panel preview">
  <p className="muted">Exploded panel inventory, not a verified assembled furniture model. One panel per cutlist row; quantities appear in the legend. Dimensions and material thickness use millimetres.</p>
  {layout.omitted>0&&<p className="muted">{layout.omitted} additional part rows omitted from the 3D view (40-row performance limit).</p>}
  {layout.panels.length===0?<p>No valid parts to preview.</p>:<>
   {webgl?<div className="panel3d-canvas" data-testid="panel-3d-canvas">
    <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[0,0,distance],fov:45,near:0.01,far:100}} fallback={<p>3D rendering is unavailable on this device. The part list remains available below.</p>}>
     <color attach="background" args={['#eaf0f5']}/>
     <ambientLight intensity={1.7}/>
     <directionalLight position={[4,5,8]} intensity={2.2}/>
     <OrbitController/>
     {layout.panels.map(panel=><PanelMesh key={panel.id} panel={panel} selected={selected===panel.id} onSelect={setSelected}/>)}
    </Canvas>
   </div>:<p role="status">WebGL2 is unavailable. Use the accessible part list below instead.</p>}
   <p className="muted">Drag to rotate · scroll/pinch to zoom · select a panel for dimensions.</p>
   {active&&<p role="status"><strong>{active.label}</strong>: {active.widthMm} × {active.heightMm} × {active.thicknessMm} mm, {active.quantity} pcs · {active.materialName}</p>}
   <div className="panel3d-legend" aria-label="3D panel selection">
    {layout.panels.map(panel=><button key={panel.id} type="button" onClick={()=>setSelected(panel.id)} aria-pressed={selected===panel.id}>{panel.label} · {panel.widthMm} × {panel.heightMm} × {panel.thicknessMm} mm · {panel.quantity} pcs</button>)}
   </div>
  </>}
 </div>
}
