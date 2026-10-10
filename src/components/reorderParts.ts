import type {Part} from '../engine/types.ts'
import {arrayMove} from '@dnd-kit/sortable'

export function reorderParts(parts:Part[], activeId:string, overId:string):Part[] {
 const from=parts.findIndex(part=>part.id===activeId)
 const to=parts.findIndex(part=>part.id===overId)
 if(from<0||to<0||from===to)return parts
 return arrayMove(parts,from,to)
}
