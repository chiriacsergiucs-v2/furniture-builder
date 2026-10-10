import {performance} from 'node:perf_hooks'
import {createProject,emptyAbs} from '../src/engine/types.ts'
import {optimizeProject} from '../src/engine/optimize.ts'
import {validateResult} from '../src/engine/validate.ts'
for(const n of [20,50,100,250]){
 const p=createProject();p.materials=p.materials.slice(0,1);p.sheets=p.sheets.slice(0,1);p.sheets[0].quantity=null;p.settings.maxRestarts=6;p.settings.maxDurationMs=10000
 p.parts=Array.from({length:n},(_,i)=>({id:`p${i}`,label:`Part ${i}`,width:100+((i*83)%801),height:120+((i*67)%701),quantity:1,materialId:'pal18',rotationAllowed:true,grain:'none',abs:emptyAbs()}))
 const start=performance.now(),result=optimizeProject(p),duration=performance.now()-start
 const problems=validateResult(p,result);if(problems.length)throw Error(problems.join('; '))
 console.log(JSON.stringify({parts:n,placed:result.stats.placed,sheets:result.stats.stockSheetCount,durationMs:Math.round(duration*100)/100,rssMiB:Math.round(process.memoryUsage().rss/1024/1024),valid:true}))
}
