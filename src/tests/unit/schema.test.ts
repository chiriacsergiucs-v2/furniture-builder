import {describe,it,expect} from 'vitest'
import {createProject,emptyAbs} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {optimizeProject} from '../../engine/optimize.ts'
import {validateResult} from '../../engine/validate.ts'
describe('project schema',()=>{
 it('accepts default project',()=>expect(validateProject(createProject())).toEqual([]))
 it('rejects fractional dimensions',()=>{const p=createProject();p.parts.push({id:'x',label:'Test',width:200.5,height:100,quantity:1,materialId:'pal18',rotationAllowed:false,grain:'none',abs:emptyAbs()});expect(validateProject(p)).not.toEqual([])})
 it('keeps materials separate',()=>{const p=createProject();p.parts.push({id:'x',label:'Test',width:900,height:900,quantity:1,materialId:'pal18',rotationAllowed:true,grain:'none',abs:emptyAbs()});const result=optimizeProject(p);expect(validateResult(p,result)).toEqual([]);expect(result.boards.every(b=>b.materialId==='pal18')).toBe(true)})
})
