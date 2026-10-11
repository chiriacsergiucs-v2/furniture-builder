import type {CabinetBox} from './cabinet.ts'
/** Physical AABB intersections in mm; touching faces or edges are not collisions.
 * These are panel geometry checks, not joint/fastener/structural certifications.
 */
export interface PanelCollision {first:number;second:number;overlapMm:[number,number,number]}
export function detectPanelCollisions(boxes:readonly CabinetBox[],toleranceMm=0.001):PanelCollision[]{
 const collisions:PanelCollision[]=[]
 const overlap=(a:number,extent:number,b:number,other:number)=>
  Math.min(a+extent,b+other)-Math.max(a,b)
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j]
  const x=overlap(a.x,a.dx,b.x,b.dx)
  if(x<=toleranceMm)continue
  const y=overlap(a.y,a.dy,b.y,b.dy)
  if(y<=toleranceMm)continue
  const z=overlap(a.z,a.dz,b.z,b.dz)
  if(z<=toleranceMm)continue
  collisions.push({first:i,second:j,overlapMm:[x,y,z]})
 }
 return collisions
}
export function panelCollisionMessages(boxes:readonly CabinetBox[]):string[]{
 return detectPanelCollisions(boxes).map(({first,second,overlapMm})=>
  'Panel overlap: '+(boxes[first].label??boxes[first].role)+' #'+(boxes[first].index+1)+
  ' intersects '+(boxes[second].label??boxes[second].role)+' #'+(boxes[second].index+1)+
  ' by '+overlapMm.map(n=>Number(n.toFixed(3))).join(' × ')+' mm.')
}
