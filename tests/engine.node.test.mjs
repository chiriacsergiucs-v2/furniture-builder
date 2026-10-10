import test from 'node:test'
import assert from 'node:assert/strict'
import {optimizeProject} from '../src/engine/optimize.ts'
import {validateResult} from '../src/engine/validate.ts'
import {createProject,emptyAbs,emptyTrim} from '../src/engine/types.ts'
import {validateProject} from '../src/engine/schema.ts'

const sample=(w=104,h=100,kw=4)=>{
 const p=createProject();p.materials=[{id:'m',name:'PAL',type:'PAL',thickness:18}];p.sheets=[{id:'s',materialId:'m',thickness:18,width:w,height:h,quantity:1,grain:'none',trim:emptyTrim()}];p.offcuts=[];p.parts=[{id:'a',label:'Panel',materialId:'m',width:50,height:100,quantity:2,rotationAllowed:false,grain:'none',abs:emptyAbs()}];p.settings.kerf=kw;p.settings.maxRestarts=8;return p
}
test('two 50x100 panels fit on 104x100 with 4mm kerf',()=>{const p=sample();const r=optimizeProject(p);assert.equal(r.stats.placed,2);assert.equal(r.stats.kerfArea,400);assert.deepEqual(validateResult(p,r),[]);assert.equal(r.stats.grossArea,r.stats.partArea+r.stats.kerfArea+r.stats.trimArea+r.stats.recoverableArea+r.stats.unrecoverableArea)})
test('103x100 cannot fit both panels',()=>{const p=sample(103);const r=optimizeProject(p);assert.equal(r.stats.placed,1);assert.equal(r.unplaced.length,1);assert.deepEqual(validateResult(p,r),[])})
test('full exact fit has zero cuts',()=>{const p=sample(50,100);p.parts[0].quantity=1;const r=optimizeProject(p);assert.equal(r.stats.cutCount,0);assert.equal(r.stats.kerfArea,0);assert.deepEqual(validateResult(p,r),[])})
test('rotation restrictions honored',()=>{const p=sample(100,50);p.parts[0].quantity=1;const r=optimizeProject(p);assert.equal(r.stats.placed,0);p.parts[0].rotationAllowed=true;const rr=optimizeProject(p);assert.equal(rr.stats.placed,1);assert.equal(rr.boards[0].placements[0].rotated,true)})
test('grain direction constraints honored',()=>{const p=sample(100,50);p.parts[0].quantity=1;p.parts[0].rotationAllowed=true;p.parts[0].grain='x';p.sheets[0].grain='x';assert.equal(optimizeProject(p).stats.placed,0);p.sheets[0].grain='y';assert.equal(optimizeProject(p).stats.placed,1)})
test('invalid sizes and quantities rejected',()=>{const p=sample();p.parts[0].quantity=0;assert.notEqual(validateProject(p).length,0);assert.throws(()=>optimizeProject(p));p.parts[0].quantity=1;p.parts[0].width=-1;assert.notEqual(validateProject(p).length,0)})
test('finite inventory and material segregation',()=>{const p=sample(50,100);p.parts[0].quantity=3;assert.equal(optimizeProject(p).stats.placed,1);p.parts[0].materialId='other';assert.ok(validateProject(p).length>0)})
test('trimming excludes usable region',()=>{const p=sample(104,100);p.sheets[0].trim.right=1;assert.equal(optimizeProject(p).stats.placed,1)})
test('deterministic positions given same seed',()=>{const p=sample(180,100);const r=optimizeProject(p),r2=optimizeProject(p);assert.deepEqual(r.boards.map(b=>b.placements),r2.boards.map(b=>b.placements))})
test('independent validator rejects corrupted geometry',()=>{const p=sample();const r=optimizeProject(p);r.boards[0].placements[0].x+=1;assert.ok(validateResult(p,r).length>0)})
test('zero kerf can fit adjacent parts',()=>{const p=sample(100,100,0);const r=optimizeProject(p);assert.equal(r.stats.placed,2);assert.deepEqual(validateResult(p,r),[])})
test('fuzz: random stock, pieces, kerf, trims',()=>{let seed=991;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);for(let i=0;i<200;i++){const w=60+Math.floor(rand()*300),h=60+Math.floor(rand()*300),p=sample(w,h,Math.floor(rand()*7));p.parts[0].width=1+Math.floor(rand()*200);p.parts[0].height=1+Math.floor(rand()*200);p.parts[0].quantity=1+Math.floor(rand()*5);p.parts[0].rotationAllowed=rand()>.5;p.sheets[0].trim.left=Math.floor(rand()*10);p.sheets[0].trim.top=Math.floor(rand()*10);const r=optimizeProject(p);assert.deepEqual(validateResult(p,r),[])}})
