import type {Project,OptimizationResult,StockSheet,CutTree,Rect} from './types.ts'
import {area,sameRect,within,grainFits,usableOf} from './geometry.ts'
import {validateProject} from './schema.ts'

// Intentionally independent from the placement/splitting routines.
export function validateResult(project:Project,result:OptimizationResult):string[]{
 const issues=validateProject(project)
 if(result.projectId!==project.id)issues.push('Result does not belong to project')
 const materials=new Map(project.materials.map(m=>[m.id,m]))
 const parts=new Map(project.parts.map(p=>[p.id,p]))
 const sources=new Map<string,StockSheet & {source:'stock'|'offcut'}>([...project.sheets.map(s=>[s.id,{...s,source:'stock' as const}] as const),...project.offcuts.map(o=>[o.id,{...o,source:'offcut' as const,trim:{top:0,right:0,bottom:0,left:0}}] as const)])
 const consumption=new Map<string,number>(),used=new Set<string>(),requested=new Set<string>()
 for(const p of project.parts)for(let i=1;i<=p.quantity;i++)requested.add(`${p.id}#${i}`)
 const treePartInstances=new Set<string>(),boards=new Set<string>()
 let grossTotal=0,usableTotal=0,trimTotal=0,kerfTotal=0,partTotal=0,cutsTotal=0,stockTotal=0,offcutTotal=0,recoverTotal=0,wasteTotal=0;const expectedOffcuts: Array<{boardId:string;rect:Rect;reusable:boolean}> = []
 for(const board of result.boards){
  if(boards.has(board.id))issues.push('Duplicate board id');boards.add(board.id)
  const original=sources.get(board.stockId)
  if(!original){issues.push(`Unknown stock ${board.stockId}`);continue}
  consumption.set(board.stockId,(consumption.get(board.stockId)??0)+1)
  if(board.source==='stock')stockTotal++;else offcutTotal++
  grossTotal+=board.width*board.height
  if(board.source!==original.source||board.materialId!==original.materialId||board.thickness!==original.thickness||board.grain!==original.grain||board.width!==original.width||board.height!==original.height||JSON.stringify(board.trim)!==JSON.stringify(original.trim))issues.push(`Source geometry or material mismatch on ${board.id}`)
  if(materials.get(board.materialId)?.thickness!==board.thickness)issues.push('Material thickness mismatch')
  const usable=usableOf(board)
  if(!sameRect(board.usable,usable))issues.push(`Incorrect usable region on ${board.id}`)
  usableTotal+=area(usable);trimTotal+=area({width:board.width,height:board.height})-area(usable)
  const list=new Map(board.placements.map(p=>[p.instanceId,p]))
  if(list.size!==board.placements.length)issues.push(`Duplicate placements on ${board.id}`)
  let leafArea=0,cutArea=0
  const visit=(node:CutTree,expected:Rect):void=>{
   if(!sameRect(node.rect,expected)){issues.push(`Tree node rectangle mismatch in ${board.id}`);return}
   if(!within(node.rect,usable)){issues.push(`Tree node outside usable area in ${board.id}`);return}
   if(node.kind==='cut'){
    const {at,kerf}=node
    if(kerf!==project.settings.kerf)issues.push('Kerf mismatch')
    if(node.orientation==='vertical'){
     const w=at-expected.x;const r=expected.width-w-kerf
     if(w<=0||r<0||at>expected.x+expected.width){issues.push('Invalid vertical cut');return}
     cutArea+=kerf*expected.height;cutsTotal++
     visit(node.first,{x:expected.x,y:expected.y,width:w,height:expected.height})
     visit(node.second,{x:at+kerf,y:expected.y,width:r,height:expected.height})
    }else if(node.orientation==='horizontal'){
     const h=at-expected.y;const b=expected.height-h-kerf
     if(h<=0||b<0||at>expected.y+expected.height){issues.push('Invalid horizontal cut');return}
     cutArea+=kerf*expected.width;cutsTotal++
     visit(node.first,{x:expected.x,y:expected.y,width:expected.width,height:h})
     visit(node.second,{x:expected.x,y:at+kerf,width:expected.width,height:b})
    }else issues.push('Unknown cut orientation')
    return
   }
   leafArea+=area(node.rect)
   if(node.kind==='waste'){const r=node.rect;if(area(r)<=0)return;const reusable=r.width>=project.settings.minOffcutWidth&&r.height>=project.settings.minOffcutHeight&&area(r)>=project.settings.minOffcutArea;expectedOffcuts.push({boardId:board.id,rect:r,reusable});if(reusable)recoverTotal+=area(r);else wasteTotal+=area(r);return}
   if(node.kind!=='part')return
   partTotal+=area(node.rect)
   if(treePartInstances.has(node.instanceId))issues.push(`Duplicate tree part ${node.instanceId}`)
   treePartInstances.add(node.instanceId)
   const p=list.get(node.instanceId)
   if(!p){issues.push(`Tree part missing placement ${node.instanceId}`);return}
   const requestedPart=parts.get(p.partId)
   if(!requestedPart||!requested.has(node.instanceId)||!node.instanceId.startsWith(`${p.partId}#`)){issues.push(`Invalid requested part instance ${node.instanceId}`);return}
   if(p.x!==node.rect.x||p.y!==node.rect.y||p.width!==node.rect.width||p.height!==node.rect.height)issues.push(`Part geometry mismatch ${node.instanceId}`)
   if(p.rotated&&(!project.settings.rotationAllowed||!requestedPart.rotationAllowed))issues.push('Forbidden rotation')
   if(p.width!==(p.rotated?requestedPart.height:requestedPart.width)||p.height!==(p.rotated?requestedPart.width:requestedPart.height))issues.push('Wrong part dimensions')
   if(requestedPart.materialId!==board.materialId||materials.get(requestedPart.materialId)?.thickness!==board.thickness)issues.push('Part stock material mismatch')
   if(!grainFits(requestedPart,board.grain,p.rotated))issues.push('Grain mismatch')
   if(used.has(node.instanceId))issues.push('Part placed on multiple boards'); used.add(node.instanceId)
  }
  visit(board.tree,usable)
  kerfTotal+=cutArea
  if(leafArea+cutArea!==area(usable))issues.push(`Area conservation failure: ${board.id}`)
  for(const placement of board.placements)if(!treePartInstances.has(placement.instanceId))issues.push(`Placement missing in tree: ${placement.instanceId}`)
 }
 for(const [sid,count] of consumption){const s=sources.get(sid);if(s&&s.quantity!==null&&count>s.quantity)issues.push(`Stock inventory exceeded: ${sid}`)}
 const unplacedSet=new Set<string>()
 for(const u of result.unplaced){if(!requested.has(u.instanceId)||!u.instanceId.startsWith(`${u.partId}#`)||unplacedSet.has(u.instanceId)||used.has(u.instanceId))issues.push(`Invalid unplaced instance ${u.instanceId}`);unplacedSet.add(u.instanceId)}
 for(const instance of requested)if(!used.has(instance)&&!unplacedSet.has(instance))issues.push(`Missing requested instance ${instance}`)
 if(!result.stats||result.stats.placed!==used.size||result.stats.unplaced!==result.unplaced.length||result.stats.requested!==requested.size)issues.push('Summary counts mismatch')
 const expected={grossArea:grossTotal,usableArea:usableTotal,trimArea:trimTotal,kerfArea:kerfTotal,partArea:partTotal,stockSheetCount:stockTotal,offcutSheetCount:offcutTotal,cutCount:cutsTotal,recoverableArea:recoverTotal,unrecoverableArea:wasteTotal}
 for(const [key,val] of Object.entries(expected))if(result.stats?.[key as keyof typeof expected]!==val)issues.push(`Incorrect ${key} statistic`)
 if(Math.abs((result.stats?.utilization??-1)-(grossTotal?100*partTotal/grossTotal:0))>1e-8)issues.push('Incorrect utilization')
 if(grossTotal!==trimTotal+kerfTotal+partTotal+recoverTotal+wasteTotal)issues.push('Gross area imbalance')
 if(!Array.isArray(result.offcuts)||result.offcuts.length!==expectedOffcuts.length)issues.push('Offcut list length mismatch')
 else for(const o of expectedOffcuts){if(!result.offcuts.some(v=>v.boardId===o.boardId&&v.x===o.rect.x&&v.y===o.rect.y&&v.width===o.rect.width&&v.height===o.rect.height&&v.reusable===o.reusable))issues.push(`Offcut mismatch on ${o.boardId}`)}
 return issues
}
