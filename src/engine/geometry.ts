import type {Rect,CutTree,Placement,StockSheet,GrainAxis,Part} from './types.ts'
export const area=(r:Pick<Rect,'width'|'height'>)=>r.width*r.height
export const sameRect=(a:Rect,b:Rect)=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height
export function within(a:Rect,b:Rect){return a.x>=b.x&&a.y>=b.y&&a.x+a.width<=b.x+b.width&&a.y+a.height<=b.y+b.height}
export const usableOf=(s:Pick<StockSheet,'width'|'height'|'trim'>):Rect=>({x:s.trim.left,y:s.trim.top,width:s.width-s.trim.left-s.trim.right,height:s.height-s.trim.top-s.trim.bottom})
export const grainFits=(part:Part,sheetGrain:GrainAxis,rotated:boolean)=>part.grain==='none'||(sheetGrain!=='none'&&(rotated?(part.grain==='x'?'y':'x'):part.grain)===sheetGrain)
export function leaves(t:CutTree):CutTree[]{return t.kind==='cut'?[...leaves(t.first),...leaves(t.second)]:[t]}
export function collectPlacements(t:CutTree,parts:Map<string,{partId:string;rotated:boolean}>):Placement[]{const result:Placement[]=[];const visit=(n:CutTree)=>{if(n.kind==='cut'){visit(n.first);visit(n.second)}else if(n.kind==='part'){const p=parts.get(n.instanceId);if(!p)throw Error('Missing placement instance');result.push({instanceId:n.instanceId,partId:p.partId,x:n.rect.x,y:n.rect.y,width:n.rect.width,height:n.rect.height,rotated:p.rotated})}};visit(t);return result}
export function countCuts(t:CutTree):number{return t.kind==='cut'?1+countCuts(t.first)+countCuts(t.second):0}
export function kerfArea(t:CutTree):number{if(t.kind!=='cut')return 0;return (t.orientation==='vertical'?t.kerf*t.rect.height:t.kerf*t.rect.width)+kerfArea(t.first)+kerfArea(t.second)}
export function replaceWaste(t:CutTree,id:string,replacement:CutTree):CutTree{return t.kind==='waste'?(t.id===id?replacement:t):t.kind==='part'?t:{...t,first:replaceWaste(t.first,id,replacement),second:replaceWaste(t.second,id,replacement)}}
