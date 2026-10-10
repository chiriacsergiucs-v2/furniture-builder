import type {Part,Project,OptimizationResult} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
const safe=(s:string)=>/^[\s]*[=+@\-\t\r]/.test(s)?`'${s}`:s
// Code-split on demand. Never store workbook bytes in localStorage.
export async function readGenericXlsx(file:File,defaultMaterialId:string):Promise<Part[]>{
 const ExcelJS=(await import('exceljs')).default;const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer() as never)
 const sheet=book.worksheets[0];if(!sheet)throw Error('Empty Excel workbook')
 const row1=sheet.getRow(1);const headers:Array<string>=[];row1.eachCell({includeEmpty:true},(cell,col)=>{headers[col-1]=String(cell.text).trim().toLowerCase()})
 const col=(names:string[])=>headers.findIndex(x=>names.includes(x))+1
 const name=col(['name','label','part','denumire']),w=col(['width_mm','width','latime']),h=col(['height_mm','height','length','lungime']),q=col(['quantity','qty','bucati']),m=col(['material_id','material'])
 if(!w||!h)throw Error('XLSX missing Width_mm/Height_mm columns; use generic template or explicit mapping')
 const output:Part[]=[];for(let n=2;n<=sheet.rowCount;n++){const row=sheet.getRow(n);if(!row.hasValues)continue;const width=Number(row.getCell(w).value),height=Number(row.getCell(h).value),quantity=q?Number(row.getCell(q).value||1):1;if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(height)||height<=0||!Number.isSafeInteger(quantity)||quantity<=0)throw Error(`Invalid spreadsheet row ${n}`)
 output.push({id:crypto.randomUUID(),label:name?row.getCell(name).text:`Part ${n-1}`,width,height,quantity,materialId:m?row.getCell(m).text||defaultMaterialId:defaultMaterialId,rotationAllowed:true,grain:'none',abs:emptyAbs()})}return output
}
export async function exportCutOrderXlsx(project:Project,result:OptimizationResult){
 const ExcelJS=(await import('exceljs')).default;const book=new ExcelJS.Workbook();book.creator='Mobila Cutlist (local-only)';const summary=book.addWorksheet('Summary');summary.addRows([['Project',safe(project.name)],['Date',result.createdAt],['Kerf mm',project.settings.kerf],['Sheets',result.boards.length],['Unplaced',result.unplaced.length],['Utilization %',result.stats.utilization]])
 const sheet=book.addWorksheet('Placements');sheet.addRow(['Board','Stock','Part name','Part ID','X mm','Y mm','W mm','H mm','Rotated','Material']);for(const b of result.boards)for(const p of b.placements)sheet.addRow([b.id,b.stockId,safe(project.parts.find(v=>v.id===p.partId)?.label??p.partId),p.partId,p.x,p.y,p.width,p.height,p.rotated?'yes':'no',b.materialId]);sheet.getRow(1).font={bold:true}
 const missing=book.addWorksheet('Unplaced');missing.addRow(['Part ID','Instance','Reason']);for(const u of result.unplaced)missing.addRow([u.partId,u.instanceId,safe(u.reason)])
 return await book.xlsx.writeBuffer()
}
export const regencyIntegrationStatus='PENDING: require original SABLON DEBITARE NOU.xlsx; no inferred Regency column mapping.'
