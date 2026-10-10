import type {Project,StockSheet,Part,Offcut} from './types.ts'
export const integer=(n:unknown,min=0):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min
export const finiteMoney=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0
export const safeString=(s:unknown):s is string=>typeof s==='string'&&s.length<=20000
export function validateProject(p:unknown):string[]{
 const errors:string[]=[]
 if(!p||typeof p!=='object')return ['Project must be an object']
 const x=p as Partial<Project>
 if(x.schemaVersion!==1)errors.push('Unsupported schema version')
 if(!safeString(x.id)||!x.id)errors.push('Project id missing')
 if(!safeString(x.name))errors.push('Invalid project name')
 if(!Array.isArray(x.materials)||!Array.isArray(x.sheets)||!Array.isArray(x.parts)||!Array.isArray(x.offcuts))return [...errors,'Arrays for materials/sheets/parts/offcuts required']
 const ids=new Set<string>(); const sourceIds=new Set<string>(); const materialMap=new Map<string,number>()
 for(const m of x.materials){if(!m||!safeString(m.id)||!m.id||ids.has(`m:${m.id}`)||!safeString(m.name)||!integer(m.thickness,1)||!['PAL','MDF','plywood','custom'].includes(m.type))errors.push('Invalid or duplicated material');else {ids.add(`m:${m.id}`);materialMap.set(m.id,m.thickness)}}
 for(const s of x.sheets as StockSheet[]){if(!s||!safeString(s.id)||!s.id||ids.has(`s:${s.id}`)||!materialMap.has(s.materialId)||materialMap.get(s.materialId)!==s.thickness||!integer(s.width,1)||!integer(s.height,1)||!(s.quantity===null||integer(s.quantity,0))||!['none','x','y'].includes(s.grain)||!s.trim||!['top','right','bottom','left'].every(k=>integer(s.trim[k as keyof StockSheet['trim']]))||s.trim.left+s.trim.right>=s.width||s.trim.top+s.trim.bottom>=s.height||(s.cost!==undefined&&!finiteMoney(s.cost)))errors.push(`Invalid sheet ${s?.id??''}`);else {ids.add(`s:${s.id}`);if(sourceIds.has(s.id))errors.push(`Duplicate stock source ID ${s.id}`);sourceIds.add(s.id)}}
 for(const o of x.offcuts as Offcut[]){if(!o||!safeString(o.id)||!o.id||ids.has(`o:${o.id}`)||!materialMap.has(o.materialId)||materialMap.get(o.materialId)!==o.thickness||!integer(o.width,1)||!integer(o.height,1)||!integer(o.quantity,1)||!['none','x','y'].includes(o.grain))errors.push(`Invalid offcut ${o?.id??''}`);else {ids.add(`o:${o.id}`);if(sourceIds.has(o.id))errors.push(`Duplicate stock source ID ${o.id}`);sourceIds.add(o.id)}}
 for(const part of x.parts as Part[]){if(!part||!safeString(part.id)||!part.id||ids.has(`p:${part.id}`)||!safeString(part.label)||!materialMap.has(part.materialId)||!integer(part.width,1)||!integer(part.height,1)||!integer(part.quantity,1)||typeof part.rotationAllowed!=='boolean'||!['none','x','y'].includes(part.grain)||!part.abs||!['top','right','bottom','left'].every(k=>part.abs[k as keyof Part['abs']]===null||safeString(part.abs[k as keyof Part['abs']])))errors.push(`Invalid part ${part?.id??''}`);else ids.add(`p:${part.id}`)}
 if(x.assemblies!==undefined){
  if(!Array.isArray(x.assemblies))errors.push('Assemblies must be an array')
  else{
   const assemblyIds=new Set<string>()
   const partMap=new Map(x.parts.map(part=>[part.id,part]))
   for(const assembly of x.assemblies){
    if(!assembly||!safeString(assembly.id)||!assembly.id||assemblyIds.has(assembly.id)||!safeString(assembly.label)||!Array.isArray(assembly.pieces)){errors.push('Invalid assembly');continue}
    assemblyIds.add(assembly.id)
    const pieceIds=new Set<string>(),assigned=new Set<string>()
    for(const piece of assembly.pieces){
     const part=partMap.get(piece?.partId)
     const allocation=piece?.partId+':'+piece?.instanceIndex
     if(!piece||!safeString(piece.id)||!piece.id||pieceIds.has(piece.id)||assigned.has(allocation)||!part||
      !integer(piece.instanceIndex)||piece.instanceIndex>=part.quantity||
      !Array.isArray(piece.positionMm)||piece.positionMm.length!==3||!piece.positionMm.every(v=>Number.isSafeInteger(v)&&Math.abs(v)<=1e7)||
      !Array.isArray(piece.rotationDeg)||piece.rotationDeg.length!==3||!piece.rotationDeg.every(v=>Number.isSafeInteger(v)&&Math.abs(v)<=360000)){
      errors.push('Invalid assembly piece '+(piece?.id??''));continue
     }
     pieceIds.add(piece.id);assigned.add(allocation)
    }
   }
  }
 }
 const s=x.settings
 if(!s||!integer(s.kerf)||!integer(s.maxDurationMs,1)||!integer(s.maxRestarts,1)||!integer(s.minOffcutWidth,1)||!integer(s.minOffcutHeight,1)||!integer(s.minOffcutArea)||!integer(s.seed)||typeof s.rotationAllowed!=='boolean')errors.push('Invalid optimization settings')
 return errors
}
