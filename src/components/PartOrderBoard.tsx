import type {CSSProperties} from 'react'
import {DndContext,closestCenter,KeyboardSensor,MouseSensor,TouchSensor,useSensor,useSensors} from '@dnd-kit/core'
import type {DragEndEvent} from '@dnd-kit/core'
import {SortableContext,sortableKeyboardCoordinates,useSortable,verticalListSortingStrategy} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import type {Part} from '../engine/types.ts'
import {reorderParts} from './reorderParts.ts'

function SortablePart({part,index,count,onMove}:{part:Part;index:number;count:number;onMove:(id:string,offset:number)=>void}){
 const {attributes,listeners,setNodeRef,transform,transition,isDragging}=useSortable({id:part.id})
 const style:CSSProperties={transform:CSS.Transform.toString(transform),transition,opacity:isDragging?0.55:1}
 return <li ref={setNodeRef} style={style} className="reorder-item">
  <button type="button" className="drag-handle" {...attributes} {...listeners} aria-label={'Drag '+part.label} title="Drag to change order">☰</button>
  <span className="reorder-label">{index+1}. {part.label} <small>({part.width} × {part.height} mm · {part.quantity} pcs)</small></span>
  <button type="button" aria-label={'Move '+part.label+' up'} disabled={index===0} onClick={()=>onMove(part.id,-1)}>↑</button>
  <button type="button" aria-label={'Move '+part.label+' down'} disabled={index===count-1} onClick={()=>onMove(part.id,1)}>↓</button>
 </li>
}
export function PartOrderBoard({parts,onChange}:{parts:Part[];onChange:(ordered:Part[])=>void}){
 const sensors=useSensors(
  useSensor(MouseSensor,{activationConstraint:{distance:6}}),
  useSensor(TouchSensor,{activationConstraint:{delay:180,tolerance:7}}),
  useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates})
 )
 if(parts.length<2)return null
 const move=(id:string,offset:number)=>{
  const index=parts.findIndex(part=>part.id===id),target=parts[index+offset]
  if(target)onChange(reorderParts(parts,id,target.id))
 }
 const end=(event:DragEndEvent)=>{
  if(event.over&&event.active.id!==event.over.id)onChange(reorderParts(parts,String(event.active.id),String(event.over.id)))
 }
 return <details className="part-order-panel">
  <summary>Reorder cutlist parts · drag, keyboard or arrows</summary>
  <p className="muted">Order is saved with the project. It does not override the optimizer's cutting heuristics.</p>
  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={end}>
   <SortableContext items={parts.map(part=>part.id)} strategy={verticalListSortingStrategy}>
    <ol className="reorder-list">{parts.map((part,i)=><SortablePart key={part.id} part={part} index={i} count={parts.length} onMove={move}/>)}</ol>
   </SortableContext>
  </DndContext>
 </details>
}
