import test from 'node:test'
import assert from 'node:assert/strict'
import {createProject,emptyAbs,emptyTrim} from '../src/engine/types.ts'
import {optimizeProject} from '../src/engine/optimize.ts'
import {validateResult} from '../src/engine/validate.ts'
import {validateProject} from '../src/engine/schema.ts'
import {toCsv,parseCsv,partsCsv,importPartsCsv} from '../src/import-export/csv.ts'
import {cuttingSvg} from '../src/import-export/svg.ts'
import {saveProject,listProjects,backupProject,restoreProject} from '../src/storage/localStorage.ts'

function projectFixture(){const p=createProject();p.parts=[{id:'p1',label:'Panel <inner> & "x"',width:200,height:300,quantity:2,materialId:'pal18',rotationAllowed:true,grain:'none',abs:{top:'ABS 2',right:null,bottom:null,left:'ABS 2'}}];p.settings.maxRestarts=3;return p}

test('independent validator rejects tampered aggregate statistics',()=>{
 const p=projectFixture(),r=optimizeProject(p);assert.deepEqual(validateResult(p,r),[])
 r.stats.kerfArea+=4;assert.ok(validateResult(p,r).some(x=>x.includes('kerfArea')))
})
test('independent validator rejects tampered offcut geometry',()=>{
 const p=projectFixture(),r=optimizeProject(p);assert.ok(r.offcuts.length>0)
 r.offcuts[0].x+=1;assert.ok(validateResult(p,r).some(x=>x.includes('Offcut mismatch')))
})
test('sheet margin omissions and duplicate source ids are rejected',()=>{
 const p=projectFixture();p.sheets[0].trim={top:0,right:0};assert.ok(validateProject(p).length)
 p.sheets[0].trim=emptyTrim();p.offcuts=[{id:p.sheets[0].id,materialId:'pal18',thickness:18,width:400,height:400,grain:'none',quantity:1}];assert.ok(validateProject(p).some(x=>x.includes('Duplicate stock source')))
})
test('CSV quotes, multiline fields, and formula injection are escaped',()=>{
 const input=[['Name','Width_mm','Height_mm','Quantity'],['Shelf,"A"\nnext',101,202,2]];
 const encoded=toCsv(input);assert.deepEqual(parseCsv(encoded),input.map(r=>r.map(String)))
 const dangerous=toCsv([['Name'],['=SUM(1,1)']]);assert.equal(parseCsv(dangerous)[1][0],"'=SUM(1,1)")
})
test('CSV cutlist export-import retains dimensions, count, and ABS assignments',()=>{
 const p=projectFixture();const csv=partsCsv(p.parts);const imported=importPartsCsv(csv,'pal18');assert.equal(imported.length,1);assert.equal(imported[0].quantity,2);assert.equal(imported[0].width,200);assert.equal(imported[0].abs.left,'ABS 2')
})
test('SVG escapes user labels and draws validated cut tree',()=>{
 const p=projectFixture(),r=optimizeProject(p);assert.deepEqual(validateResult(p,r),[]);
 const svg=cuttingSvg(r.boards[0],p);assert.ok(svg.includes('&lt;inner&gt;'));assert.ok(svg.includes('&amp;'));assert.ok(!svg.includes('<inner>'))
})
test('JSON persistence survives reopening, restoring and rejects corruption',()=>{
 const data=new Map();globalThis.window={localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)}};
 const p=projectFixture(),saved=saveProject(p);assert.equal(listProjects().length,1);assert.equal(listProjects()[0].id,saved.id);
 const json=backupProject(p);assert.throws(()=>restoreProject(json));const restored=restoreProject(json,true);assert.equal(restored.id,p.id);
 const invalidResult={junk:4};data.set('mobila-cutlist:project:'+p.id,JSON.stringify({...p,lastResult:invalidResult}));assert.equal(listProjects().length,1);assert.equal(listProjects()[0].lastResult,undefined)
})
