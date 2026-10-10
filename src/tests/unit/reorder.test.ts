import {describe,it,expect} from 'vitest'
import {createProject,emptyAbs} from '../../engine/types.ts'
import {reorderParts} from '../../components/reorderParts.ts'

describe('cutlist row reordering',()=>{
 it('reorders by stable IDs without changing manufacturing data',()=>{
  const p=createProject()
  p.parts=['a','b','c'].map((id,i)=>({id,label:id,width:200+i,height:100,quantity:1,materialId:'pal18',rotationAllowed:true,grain:'none' as const,abs:emptyAbs()}))
  const result=reorderParts(p.parts,'a','c')
  expect(result.map(item=>item.id)).toEqual(['b','c','a'])
  expect(result.find(item=>item.id==='a')).toEqual(p.parts[0])
  expect(p.parts.map(item=>item.id)).toEqual(['a','b','c'])
 })
 it('ignores unknown IDs and self-moves',()=>{
  const p=createProject()
  p.parts=[{id:'a',label:'x',width:100,height:100,quantity:1,materialId:'pal18',rotationAllowed:true,grain:'none',abs:emptyAbs()}]
  expect(reorderParts(p.parts,'x','a')).toBe(p.parts)
  expect(reorderParts(p.parts,'a','a')).toBe(p.parts)
 })
})
