import {useEffect,useMemo,useState} from 'react'
import {Canvas,useThree} from '@react-three/fiber'
import {BoxGeometry,EdgesGeometry,MathUtils} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import type {Project} from '../engine/types.ts'
import type {ProjectAssembly} from '../assembly/model.ts'
import {deriveFurnitureModel} from '../furniture/furniture-model.ts'

function CameraControls({focus}:{focus:[number,number,number]}){
 const {camera,gl,invalidate}=useThree()
 useEffect(()=>{
  const controls=new OrbitControls(camera,gl.domElement)
  controls.target.set(...focus);controls.enableDamping=false
  controls.minDistance=.25;controls.maxDistance=60
  const onChange=()=>invalidate()
  controls.addEventListener('change',onChange);controls.update()
  return()=>{controls.removeEventListener('change',onChange);controls.dispose()}
 },[camera,gl,invalidate,focus])
 return null
}
export default function PositionedFurniturePreview({project,assembly}:{project:Project;assembly:ProjectAssembly}){
 const pieces=deriveFurnitureModel(project,assembly).solids
 const [supported]=useState(()=>{try{return Boolean(document.createElement('canvas').getContext('webgl2'))}catch{return false}})
 const focus=useMemo(():[number,number,number]=>{
  if(!pieces.length)return [0,0,0]
  return [0,1,2].map(i=>pieces.reduce((total,x)=>total+x.instance.positionMm[i]/1000,0)/pieces.length) as [number,number,number]
 },[pieces])
 const span=Math.max(.5,...pieces.map(x=>Math.max(x.part.width,x.part.height,x.material.thickness)/1000+
  Math.hypot(...x.instance.positionMm.map((v,i)=>v/1000-focus[i]))))
 const colors={PAL:'#bca98f',MDF:'#8ea7bc',plywood:'#bd9c72',custom:'#80aea5'}
 if(!supported)return <p role="status">3D rendering is unavailable on this device. The saved assembly and cut list remain available.</p>
 return <div className="cabinet-preview" role="region" aria-label="Complete furniture 3D preview">
  <Canvas frameloop="demand" dpr={[1,1.5]} camera={{position:[focus[0]+span*1.3,focus[1]+span*.95,focus[2]+span*1.6],near:.01,far:150,fov:42}}>
   <color attach="background" args={['#edf3f7']}/>
   <ambientLight intensity={1.7}/><directionalLight position={[3,5,7]} intensity={2.1}/>
   <CameraControls focus={focus}/>
   {pieces.map(({instance,part,material})=><Board key={instance.id} instance={instance}
    dimensions={[part.width,part.height,material.thickness]} color={colors[material.type]}/>)}
  </Canvas>
 </div>
}
function Board({instance,dimensions,color}:{instance:ProjectAssembly['pieces'][number];dimensions:[number,number,number];color:string}){
 const geometry=useMemo(()=>new BoxGeometry(...dimensions.map(x=>x/1000) as [number,number,number]),[dimensions[0],dimensions[1],dimensions[2]])
 const edges=useMemo(()=>new EdgesGeometry(geometry),[geometry])
 useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges])
 return <group position={instance.positionMm.map(x=>x/1000) as [number,number,number]}
  rotation={instance.rotationDeg.map(MathUtils.degToRad) as [number,number,number]}>
  <mesh geometry={geometry}><meshStandardMaterial color={color} roughness={.72}/></mesh>
  <lineSegments geometry={edges}><lineBasicMaterial color="#536a7b"/></lineSegments>
 </group>
}
