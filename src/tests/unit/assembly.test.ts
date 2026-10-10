import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {createDrawer40x30,addPartInstances,newAssembly,resolveAssembly} from '../../assembly/model.ts'
import {exportFusionPython} from '../../assembly/fusion.ts'

describe('positioned 40 × 30 drawer and Fusion export',()=>{
 it('generates four cutlist types and five independently positioned panels',()=>{
  const p=createProject()
  const {parts,assembly}=createDrawer40x30(p)
  expect(parts.map(v=>[v.label,v.width,v.height,v.quantity])).toEqual([
   ['Drawer side',300,250,2],['Drawer back',300,250,1],
   ['Drawer front (inner)',300,250,1],['Front Main',400,300,1]
  ])
  expect(assembly.pieces).toHaveLength(5)
  expect(new Set(assembly.pieces.map(x=>x.id)).size).toBe(5)
  expect(assembly.pieces.map(x=>x.positionMm)).toEqual([
   [-159,0,0],[159,0,0],[0,0,-141],[0,0,141],[0,0,161]
  ])
  expect(assembly.pieces[0].rotationDeg).toEqual([0,90,0])
  p.parts.push(...parts);p.assemblies=[assembly]
  expect(validateProject(p)).toEqual([])
  expect(resolveAssembly(p,assembly)).toHaveLength(5)
  const restored=JSON.parse(JSON.stringify(p))
  expect(validateProject(restored)).toEqual([])
  expect(restored.assemblies[0].pieces).toHaveLength(5)
 })
 it('prevents malformed transforms and duplicated instances',()=>{
  const p=createProject(),built=createDrawer40x30(p)
  p.parts=built.parts;p.assemblies=[built.assembly]
  p.assemblies[0].pieces[0].positionMm=[1.5,0,0]
  expect(validateProject(p)).toContain('Invalid assembly piece '+p.assemblies[0].pieces[0].id)
  p.assemblies[0].pieces[0].positionMm=[0,0,0]
  p.assemblies[0].pieces[1].instanceIndex=0
  expect(validateProject(p)).toEqual(expect.arrayContaining([expect.stringContaining('Invalid assembly piece')]))
 })
 it('places every unassigned quantity instance and preserves existing positions',()=>{
  const p=createProject(),built=createDrawer40x30(p)
  const a=addPartInstances(newAssembly('Custom'),built.parts[0])
  expect(a.pieces.map(x=>x.instanceIndex)).toEqual([0,1])
  expect(addPartInstances(a,built.parts[0]).pieces).toHaveLength(2)
 })
 it('exports separate solid bodies using centimetre conversions and all placements',()=>{
  const p=createProject(),built=createDrawer40x30(p)
  p.parts=built.parts;p.assemblies=[built.assembly]
  const source=exportFusionPython(p,built.assembly)
  expect(source).toContain('TemporaryBRepManager.get()')
  expect(source).toContain('occurrences.addNewComponent')
  expect(source).toContain('bRepBodies.add(temp)')
  expect(source).toContain("item['widthMm']/10.0")
  expect(source).toContain('Drawer side')
  expect(source).toContain('Front Main')
  expect(source).toContain('rotationDeg')
  expect(source).toContain('"positionMm"')
 })
 it('rejects missing PAL 18 mm rather than silently changing thickness',()=>{
  const p=createProject();p.materials=p.materials.filter(m=>m.type!=='PAL')
  expect(()=>createDrawer40x30(p)).toThrow(/PAL 18 mm/)
 })
})
