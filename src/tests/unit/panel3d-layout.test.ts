import {describe,it,expect} from 'vitest'
import {layoutPreviewParts} from '../../components/panel3d-layout.ts'
import {createProject,emptyAbs} from '../../engine/types.ts'
import type {Part} from '../../engine/types.ts'

function makePart(id:string,width:number,height:number):Part{
 return {id,label:'Panel '+id,width,height,quantity:2,materialId:'pal18',rotationAllowed:true,grain:'none',abs:emptyAbs()}
}
describe('dimensionally faithful 3D inventory layout',()=>{
 it('preserves exact width, height, material thickness and quantity',()=>{
  const p=createProject();p.parts=[makePart('a',900,450)]
  const result=layoutPreviewParts(p.parts,p.materials)
  expect(result.panels[0].size).toEqual([0.9,0.45,0.018])
  expect(result.panels[0].quantity).toBe(2)
 })
 it('never overlaps face extents and centers rows',()=>{
  const p=createProject();p.parts=[makePart('a',500,800),makePart('b',500,700),makePart('c',150,100),makePart('d',600,120)]
  const result=layoutPreviewParts(p.parts,p.materials)
  for(let i=0;i<result.panels.length;i++)for(let j=i+1;j<result.panels.length;j++){
   const a=result.panels[i],b=result.panels[j]
   const separated=Math.abs(a.position[0]-b.position[0])>=(a.size[0]+b.size[0])/2-1e-9||
    Math.abs(a.position[1]-b.position[1])>=(a.size[1]+b.size[1])/2-1e-9
   expect(separated).toBe(true)
  }
 })
 it('bounds the GPU workload and excludes invalid temporary editor values',()=>{
  const p=createProject();p.parts=Array.from({length:46},(_,i)=>makePart(String(i),i===0?NaN:100,300))
  const result=layoutPreviewParts(p.parts,p.materials,40)
  expect(result.panels).toHaveLength(40)
  expect(result.omitted).toBe(5)
 })
})
