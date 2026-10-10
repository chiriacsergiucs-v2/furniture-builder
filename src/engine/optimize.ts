import type {Project,BoardLayout,OptimizationResult,Part,Rect,StockSheet,Heuristic,Unplaced,CutTree,ResultStatistics,RemainingOffcut} from './types.ts'
import {area,leaves,usableOf,grainFits,replaceWaste,collectPlacements,kerfArea,countCuts} from './geometry.ts'
import {fitRect,insertIntoWaste,scoreFit} from './guillotine.ts'
import {validateProject} from './schema.ts'
import {validateResult} from './validate.ts'

type Piece={part:Part;instanceId:string}
type Source=StockSheet&{source:'stock'|'offcut'}
const makeRng=(seed:number)=>{let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
const stockSources=(p:Project):Source[]=>[...p.offcuts.map(o=>({id:o.id,materialId:o.materialId,thickness:o.thickness,width:o.width,height:o.height,quantity:o.quantity,grain:o.grain,trim:{top:0,right:0,bottom:0,left:0},source:'offcut' as const})),...p.sheets.map(s=>({...s,source:'stock' as const}))]
function expanded(p:Project){const result:Piece[]=[];for(const part of p.parts)for(let i=1;i<=part.quantity;i++)result.push({part,instanceId:`${part.id}#${i}`});return result}
const score=(r:OptimizationResult):number[]=>[r.unplaced.length,r.stats.stockSheetCount,r.stats.unrecoverableArea,-r.stats.recoverableArea,r.stats.cutCount]
function isBetter(a:OptimizationResult,b:OptimizationResult){const x=score(a),y=score(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]<y[i];return JSON.stringify(a.boards.map(v=>v.placements.map(p=>p.instanceId)))<JSON.stringify(b.boards.map(v=>v.placements.map(p=>p.instanceId)))}
export function calculateStatistics(p:Project,boards:BoardLayout[],unplaced:Unplaced[]):{stats:ResultStatistics;offcuts:RemainingOffcut[]}{
 const partsById=new Map(p.parts.map(v=>[v.id,v]))
 let grossArea=0,usableArea=0,partArea=0,trimArea=0,kerf=0,recoverable=0,unrecoverable=0,cuts=0
 const offcuts:RemainingOffcut[]=[],edgeBandMm:Record<string,number>={}
 for(const b of boards){const gross=b.width*b.height,grossUsable=area(b.usable);grossArea+=gross;usableArea+=grossUsable;trimArea+=gross-grossUsable;kerf+=kerfArea(b.tree);cuts+=countCuts(b.tree)
  for(const placement of b.placements){partArea+=placement.width*placement.height;const part=partsById.get(placement.partId);if(part)for(const side of ['top','right','bottom','left'] as const){const band=part.abs[side];if(band)edgeBandMm[band]=(edgeBandMm[band]??0)+(side==='top'||side==='bottom'?part.width:part.height)}}
  for(const leaf of leaves(b.tree)){if(leaf.kind!=='waste'||area(leaf.rect)<=0)continue;const r=leaf.rect, reusable=r.width>=p.settings.minOffcutWidth&&r.height>=p.settings.minOffcutHeight&&area(r)>=p.settings.minOffcutArea
   offcuts.push({...r,boardId:b.id,materialId:b.materialId,thickness:b.thickness,grain:b.grain,reusable});if(reusable)recoverable+=area(r);else unrecoverable+=area(r)
  }
 }
 return {stats:{requested:p.parts.reduce((n,a)=>n+a.quantity,0),placed:boards.reduce((n,b)=>n+b.placements.length,0),unplaced:unplaced.length,stockSheetCount:boards.filter(b=>b.source==='stock').length,offcutSheetCount:boards.filter(b=>b.source==='offcut').length,grossArea,usableArea,partArea,trimArea,kerfArea:kerf,recoverableArea:recoverable,unrecoverableArea:unrecoverable,utilization:grossArea?partArea/grossArea*100:0,cutCount:cuts,edgeBandMm},offcuts}
}
function runAttempt(project:Project,sources:Source[],pieces:Piece[],heuristic:Heuristic,cutOrder:'vertical-first'|'horizontal-first',attempt:number):OptimizationResult{
 const boards:BoardLayout[]=[],usage=new Map<string,number>(),unplaced:Unplaced[]=[],metadata=new Map<string,{partId:string;rotated:boolean}>()
 let idCounter=0;const id=()=>`w${++idCounter}`
 const kerf=project.settings.kerf
 for(const piece of pieces){
  const possibilities:{board:BoardLayout|null;source:Source;slot:Rect;leafId:string;rotated:boolean;w:number;h:number;fit:number;cost:number}[]=[]
  const consider=(source:Source,board:BoardLayout|null)=>{
   if(source.materialId!==piece.part.materialId)return
   const rects=board?leaves(board.tree).filter((x):x is Extract<CutTree,{kind:'waste'}>=>x.kind==='waste'&&area(x.rect)>0).map(x=>({rect:x.rect,id:x.id})):[{rect:usableOf(source),id:''}]
   for(const slot of rects)for(const rotated of [false,true]){
    if(rotated&&(!piece.part.rotationAllowed||!project.settings.rotationAllowed||piece.part.width===piece.part.height))continue
    if(!grainFits(piece.part,source.grain,rotated))continue
    const w=rotated?piece.part.height:piece.part.width,h=rotated?piece.part.width:piece.part.height
    if(!fitRect(slot.rect,w,h,kerf))continue
    possibilities.push({board,source,slot:slot.rect,leafId:slot.id,rotated,w,h,fit:scoreFit(slot.rect,w,h,heuristic),cost:board?0:source.source==='offcut'?1:2})
   }
  }
  for(const board of boards){const src=sources.find(x=>x.id===board.stockId);if(src)consider(src,board)}
  for(const source of sources){const used=usage.get(source.id)??0;if(source.quantity===null||used<source.quantity)consider(source,null)}
  possibilities.sort((a,b)=>a.cost-b.cost||a.fit-b.fit||a.slot.width-b.slot.width||a.source.id.localeCompare(b.source.id)||Number(a.rotated)-Number(b.rotated))
  const selected=possibilities[0]
  if(!selected){unplaced.push({instanceId:piece.instanceId,partId:piece.part.id,reason:'No physically valid sheet/offcut slot with remaining inventory, grain and kerf constraints'});continue}
  const replacement=insertIntoWaste(selected.slot,selected.w,selected.h,piece.instanceId,kerf,cutOrder,id)
  metadata.set(piece.instanceId,{partId:piece.part.id,rotated:selected.rotated})
  if(selected.board){selected.board.tree=replaceWaste(selected.board.tree,selected.leafId,replacement);selected.board.placements=collectPlacements(selected.board.tree,metadata)}
  else {const s=selected.source; const board:BoardLayout={id:`board-${attempt}-${boards.length+1}`,stockId:s.id,source:s.source,materialId:s.materialId,thickness:s.thickness,grain:s.grain,width:s.width,height:s.height,trim:s.trim,usable:usableOf(s),tree:replacement,placements:[]}; board.placements=collectPlacements(board.tree,metadata);boards.push(board);usage.set(s.id,(usage.get(s.id)??0)+1)}
 }
 const calc=calculateStatistics(project,boards,unplaced)
 return {projectId:project.id,createdAt:new Date(0).toISOString(),boards,unplaced,...calc,search:{attempts:attempt,elapsedMs:0,seed:project.settings.seed,strategy:`${heuristic}/${cutOrder}`},valid:false,errors:[]}
}
export function optimizeProject(project:Project):OptimizationResult{
 const errors=validateProject(project);if(errors.length)throw Error(errors.join('; '))
 const start=Date.now(),rng=makeRng(project.settings.seed),sources=stockSources(project)
 const pieces=expanded(project);const modes:Heuristic[]=['area','short','long']
 let best:OptimizationResult|undefined,attempts=0
 for(let i=0;i<project.settings.maxRestarts;i++){
  if(i>0&&Date.now()-start>=project.settings.maxDurationMs)break
  const strategy=modes[i%3],order=i%2?'horizontal-first':'vertical-first',sorted=[...pieces]
  if(i%4===0)sorted.sort((a,b)=>area(b.part)-area(a.part)||a.instanceId.localeCompare(b.instanceId))
  else if(i%4===1)sorted.sort((a,b)=>Math.max(b.part.width,b.part.height)-Math.max(a.part.width,a.part.height)||a.instanceId.localeCompare(b.instanceId))
  else if(i%4===2)sorted.sort((a,b)=>b.part.height-a.part.height||b.part.width-a.part.width||a.instanceId.localeCompare(b.instanceId))
  else sorted.sort((a,b)=>area(b.part)-area(a.part)||a.instanceId.localeCompare(b.instanceId))
  if(i%4===3){const ranks=new Map(sorted.map(p=>[p.instanceId,rng()]));sorted.sort((a,b)=>(ranks.get(a.instanceId)??0)-(ranks.get(b.instanceId)??0))}
  const result=runAttempt(project,sources,sorted,strategy,order,i+1)
  const problems=validateResult(project,result)
  if(problems.length)throw Error(`Optimizer generated invalid result: ${problems.join('; ')}`)
  attempts++
  if(!best||isBetter(result,best))best=result
 }
 if(!best)throw Error('Search time budget exhausted before producing a candidate')
 best.createdAt=new Date().toISOString();best.search.attempts=attempts;best.search.elapsedMs=Date.now()-start;best.valid=true;return best
}
