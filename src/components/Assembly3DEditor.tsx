import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {RefObject} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {BoxGeometry,EdgesGeometry,Group,MathUtils} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {TransformControls} from 'three/addons/controls/TransformControls.js'
import type {Project} from '../engine/types.ts'
import type {ProjectAssembly,AssemblyPiece,Vec3} from '../assembly/model.ts'
import {addPartInstances,resolveAssembly} from '../assembly/model.ts'

type GizmoMode='translate'|'rotate'
const digits=['X','Y','Z'] as const
const palette={PAL:'#b2a393',MDF:'#526b88',plywood:'#b99667',custom:'#76a39f'} as const
function webgl2(){try{return Boolean(document.createElement('canvas').getContext('webgl2'))}catch{return false}}
function CameraOrbit({controlRef,focus}:{controlRef:RefObject<OrbitControls|null>;focus:number}){
 const {camera,gl,invalidate}=useThree()
 useEffect(()=>{
  const orbit=new OrbitControls(camera,gl.domElement)
  orbit.target.set(focus,0,0)
  orbit.minDistance=.15;orbit.maxDistance=80;orbit.enableDamping=false
  const change=()=>invalidate()
  orbit.addEventListener('change',change);orbit.update()
  controlRef.current=orbit
  return()=>{orbit.removeEventListener('change',change);orbit.dispose();controlRef.current=null}
 },[camera,gl,invalidate,focus,controlRef])
 return null
}
function Gizmo({target,mode,orbitRef,onCommit}:{target:Group;mode:GizmoMode;orbitRef:RefObject<OrbitControls|null>;onCommit:(pos:Vec3,rot:Vec3)=>void}){
 const {camera,gl,scene,invalidate}=useThree()
 useEffect(()=>{
  const gizmo=new TransformControls(camera,gl.domElement)
  gizmo.setMode(mode);gizmo.setSpace('world')
  gizmo.setTranslationSnap(.001);gizmo.setRotationSnap(MathUtils.degToRad(5))
  gizmo.setSize(.65);gizmo.attach(target)
  const helper=gizmo.getHelper()
  scene.add(helper)
  const changed=()=>invalidate()
  const drag=(e:{value:unknown})=>{if(orbitRef.current)orbitRef.current.enabled=e.value!==true}
  const mouseUp=()=>{
   onCommit(target.position.toArray().map(x=>Math.round(x*1000)) as Vec3,
    [target.rotation.x,target.rotation.y,target.rotation.z].map(x=>Math.round(MathUtils.radToDeg(x))) as Vec3)
  }
  gizmo.addEventListener('change',changed)
  gizmo.addEventListener('dragging-changed',drag)
  gizmo.addEventListener('mouseUp',mouseUp)
  invalidate()
  return()=>{
   if(orbitRef.current)orbitRef.current.enabled=true
   gizmo.removeEventListener('change',changed)
   gizmo.removeEventListener('dragging-changed',drag)
   gizmo.removeEventListener('mouseUp',mouseUp)
   gizmo.detach();scene.remove(helper);gizmo.dispose()
  }
 },[camera,gl,scene,invalidate,target,mode,orbitRef,onCommit])
 return null
}
function Piece3D({piece,width,height,thickness,materialType,selected,onClick,mode,orbitRef,onCommit}:{
 piece:AssemblyPiece;width:number;height:number;thickness:number;materialType:keyof typeof palette;
 selected:boolean;onClick:()=>void;mode:GizmoMode;orbitRef:RefObject<OrbitControls|null>;
 onCommit:(pos:Vec3,rot:Vec3)=>void
}){
 const [target,setTarget]=useState<Group|null>(null)
 const ref=useCallback((obj:Group|null)=>setTarget(obj),[])
 const size:[number,number,number]=[width/1000,height/1000,thickness/1000]
 const geometry=useMemo(()=>new BoxGeometry(...size),[width,height,thickness])
 const edges=useMemo(()=>new EdgesGeometry(geometry),[geometry])
 useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges])
 const pos=piece.positionMm.map(x=>x/1000) as Vec3
 const rot=piece.rotationDeg.map(x=>MathUtils.degToRad(x)) as Vec3
 return <>
  <group ref={ref} position={pos} rotation={rot}>
   <mesh geometry={geometry} onClick={e=>{e.stopPropagation();onClick()}}>
    <meshStandardMaterial color={selected?'#f3a640':palette[materialType]} roughness={.56} metalness={.04}/>
   </mesh>
   <lineSegments geometry={edges}><lineBasicMaterial color={selected?'#7e3817':'#1d3855'}/></lineSegments>
  </group>
  {selected&&target&&<Gizmo target={target} mode={mode} orbitRef={orbitRef} onCommit={onCommit}/>}
 </>
}
function Scene({project,assembly,selectedId,setSelectedId,mode,onCommit}:{project:Project;assembly:ProjectAssembly;
 selectedId:string;setSelectedId:(id:string)=>void;mode:GizmoMode;onCommit:(pieceId:string,pos:Vec3,rot:Vec3)=>void}){
 const orbitRef=useRef<OrbitControls|null>(null)
 const pieces=resolveAssembly(project,assembly)
 const center=pieces.length?pieces.reduce((n,x)=>n+x.instance.positionMm[0],0)/pieces.length/1000:0
 const extent=pieces.reduce((n,x)=>Math.max(n,Math.abs(x.instance.positionMm[0]/1000-center)+x.part.width/1000),1)
 return <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[center+extent*.85,.8,Math.max(1.25,extent*2.4)],fov:40,near:.01,far:120}}>
  <color attach="background" args={['#e9eff4']}/>
  <ambientLight intensity={1.6}/><directionalLight position={[3,5,7]} intensity={2.4}/>
  <axesHelper args={[.55]}/><gridHelper args={[2.5,20,'#adc1ce','#dae0e4']} position={[0,-.21,0]}/>
  <CameraOrbit controlRef={orbitRef} focus={center}/>
  {pieces.map(({instance,part,material})=><Piece3D key={instance.id} piece={instance}
   width={part.width} height={part.height} thickness={material.thickness} materialType={material.type}
   selected={instance.id===selectedId} onClick={()=>setSelectedId(instance.id)}
   mode={mode} orbitRef={orbitRef} onCommit={(pos,rot)=>onCommit(instance.id,pos,rot)}/>)}
 </Canvas>
}
export default function Assembly3DEditor({project,onChangeAssembly,onExportFusion}:{
 project:Project;onChangeAssembly:(a:ProjectAssembly)=>void;onExportFusion:(a:ProjectAssembly)=>void
}){
 const assemblies=project.assemblies??[]
 const [assemblyId,setAssemblyId]=useState(assemblies[assemblies.length-1]?.id??'')
 const assembly=assemblies.find(a=>a.id===assemblyId)??assemblies[assemblies.length-1]
 const [selectedId,setSelectedId]=useState('')
 const [mode,setMode]=useState<GizmoMode>('translate')
 const [partId,setPartId]=useState(project.parts[0]?.id??'')
 const [canRender]=useState(webgl2)
 const pieces=useMemo(()=>assembly?resolveAssembly(project,assembly):[],[project,assembly])
 const selected=pieces.find(x=>x.instance.id===selectedId)??pieces[0]
 useEffect(()=>{if(!assembly)return;if(!assembly.pieces.some(x=>x.id===selectedId))setSelectedId(assembly.pieces[0]?.id??'')},[assembly,selectedId])
 const update=(pieceId:string,pos:Vec3,rot:Vec3)=>{
  if(!assembly)return
  const revised:ProjectAssembly={...assembly,updatedAt:new Date().toISOString(),
   pieces:assembly.pieces.map(piece=>piece.id===pieceId?{...piece,positionMm:pos,rotationDeg:rot}:piece)}
  onChangeAssembly(revised)
 }
 const changeAxis=(kind:'positionMm'|'rotationDeg',axis:number,value:number)=>{
  if(!selected||!Number.isSafeInteger(value)||Math.abs(value)>1e7)return
  const p=selected.instance
  const next=[...p[kind]] as Vec3;next[axis]=value
  update(p.id,kind==='positionMm'?next:p.positionMm,kind==='rotationDeg'?next:p.rotationDeg)
 }
 const addPart=()=>{
  if(!assembly)return
  const part=project.parts.find(x=>x.id===partId)
  if(part)onChangeAssembly(addPartInstances(assembly,part))
 }
 const removePiece=()=>{
  if(!assembly||!selected)return
  onChangeAssembly({...assembly,pieces:assembly.pieces.filter(p=>p.id!==selected.instance.id),updatedAt:new Date().toISOString()})
  setSelectedId('')
 }
 return <div className="assembly-editor" role="region" aria-label="3D assembly editor">
  <p className="muted">Real panel positions in X/Y/Z space. All transforms are saved in the project (mm and degrees). Every panel is an independent solid, including both sides of the drawer.</p>
  <div className="form-grid">
   <label className="field"><span>Assembly</span><select value={assembly.id} onChange={e=>{setAssemblyId(e.target.value);setSelectedId('')}}>
    {assemblies.map(a=><option key={a.id} value={a.id}>{a.label} · {a.pieces.length} panels</option>)}
   </select></label>
   <label className="field"><span>Position tool</span><select value={mode} onChange={e=>setMode(e.target.value as GizmoMode)}>
    <option value="translate">Move panel (XYZ)</option><option value="rotate">Rotate panel (XYZ)</option>
   </select></label>
  </div>
  {pieces.length===0?<p>No panels in this assembly. Add cutlist parts below.</p>:<>
   {canRender?<div className="panel3d-canvas assembly-canvas" data-testid="assembly-3d-canvas">
    <Scene project={project} assembly={assembly} selectedId={selected?.instance.id??''} setSelectedId={setSelectedId} mode={mode}
     onCommit={update}/>
   </div>:<p role="status">3D is unavailable without WebGL2. Exact position and rotation fields remain editable.</p>}
   <p className="muted">Select a panel to edit; drag colored XYZ gizmo to move/rotate. Arrow axes are world-aligned. Mouse drag on empty space rotates the camera.</p>
   <div className="panel3d-legend" aria-label="Assembly panel selection">
    {pieces.map(({instance,part})=><button key={instance.id} onClick={()=>setSelectedId(instance.id)}
     aria-pressed={instance.id===selected?.instance.id}>{part.label} #{instance.instanceIndex+1}</button>)}
   </div>
   {selected&&<div className="assembly-transform" role="group" aria-label="Selected panel transform">
    <strong>{selected.part.label} #{selected.instance.instanceIndex+1}</strong>
    <p className="muted">Cut: {selected.part.width} × {selected.part.height} × {selected.material.thickness} mm</p>
    <div className="form-grid">
     {digits.map((axis,i)=><label className="field" key={'p'+i}><span>{axis} mm</span>
      <input type="number" step="1" value={selected.instance.positionMm[i]} onChange={e=>changeAxis('positionMm',i,Number(e.target.value))}/>
     </label>)}
     {digits.map((axis,i)=><label className="field" key={'r'+i}><span>Rotation {axis} °</span>
      <input type="number" step="1" value={selected.instance.rotationDeg[i]} onChange={e=>changeAxis('rotationDeg',i,Number(e.target.value))}/>
     </label>)}
    </div>
    <button className="danger" onClick={removePiece}>Remove selected from assembly</button>
   </div>}
  </>}
  <div className="actions">
   <label className="field"><span>Cutlist item to place</span><select value={partId} onChange={e=>setPartId(e.target.value)}>
    {project.parts.map(p=><option key={p.id} value={p.id}>{p.label} · {p.quantity} pcs</option>)}
   </select></label>
   <button disabled={!project.parts.length} onClick={addPart}>Place all unassigned instances</button>
   <button className="primary" disabled={!pieces.length} onClick={()=>onExportFusion(assembly)}>Export Fusion 360 Python</button>
  </div>
  <p className="muted">Fusion export creates separately named, editable direct-model solids through Fusion’s Python API, not a STEP/F3D file. Use Utilities → Scripts and Add-Ins, then save/export from Fusion. No machining joints, hardware or bottom panel are implied.</p>
 </div>
}
