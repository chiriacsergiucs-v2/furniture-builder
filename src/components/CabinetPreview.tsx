import {useEffect,useMemo} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {BoxGeometry,EdgesGeometry} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {CabinetBox,CabinetSpec} from '../furniture/cabinet.ts'
import {totalCabinetWidth} from '../furniture/cabinet.ts'

function Orbit(){
 const {camera,gl,invalidate}=useThree()
 useEffect(()=>{
  const controls=new OrbitControls(camera,gl.domElement)
  controls.enableDamping=false
  controls.minDistance=.4
  controls.maxDistance=20
  const refresh=()=>invalidate()
  controls.addEventListener('change',refresh)
  controls.update()
  return()=>{controls.removeEventListener('change',refresh);controls.dispose()}
 },[camera,gl,invalidate])
 return null
}
function Board({item,spec}:{item:CabinetBox;spec:CabinetSpec}){
 const geometry=useMemo(()=>new BoxGeometry(item.dx/1000,item.dz/1000,item.dy/1000),[item.dx,item.dy,item.dz])
 const edges=useMemo(()=>new EdgesGeometry(geometry),[geometry])
 useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges])
 const color=item.role==='Side panel'?'#bca98f':item.role==='Shelf'?'#97b9c9':'#cdbfa9'
 return <group position={[
  (item.x+item.dx/2-totalCabinetWidth(spec)/2)/1000,
  (item.z+item.dz/2-spec.height/2)/1000,
  (spec.depth/2-item.y-item.dy/2)/1000
 ]}>
  <mesh geometry={geometry}><meshStandardMaterial color={color} roughness={.72}/></mesh>
  <lineSegments geometry={edges}><lineBasicMaterial color="#536a7b"/></lineSegments>
 </group>
}
export default function CabinetPreview({spec,boxes}:{spec:CabinetSpec;boxes:CabinetBox[]}){
 const span=Math.max(totalCabinetWidth(spec),spec.height,spec.depth)/1000
 const can3d=typeof document!=='undefined'&&Boolean(document.createElement('canvas').getContext('webgl2'))
 if(!can3d)return <div className="cabinet-no-webgl">3D preview unavailable. Manufacturing dimensions and cut list remain accessible.</div>
 return <div className="cabinet-preview" role="img" aria-label="Orbitable 3D preview of configured cabinet">
  <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[span*1.2,span*.8,span*1.6],fov:42,near:.01,far:100}}>
   <color attach="background" args={['#edf3f7']}/>
   <ambientLight intensity={1.7}/><directionalLight position={[3,4,5]} intensity={2}/>
   <Orbit/>
   {boxes.map((b,i)=><Board key={i} item={b} spec={spec}/>)}
  </Canvas>
 </div>
}
