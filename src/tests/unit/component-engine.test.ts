import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetDefaults,cabinetBoxes,createCabinetForProject,createCabinetPreset,reconfigureCabinet} from '../../furniture/cabinet.ts'
import {componentRegistry,createCabinetComponentTree,resolveComponentTree} from '../../furniture/component-engine.ts'
import {furnitureTemplates,initialSpecForTemplate} from '../../furniture/templates.ts'

describe('B01-B04: versioned templates and propagated component trees',()=>{
 it('resolves only ready versioned recipes with a registered root definition',()=>{
  const ready=furnitureTemplates.filter(t=>t.status==='ready')
  expect(ready).toHaveLength(29)
  for(const t of ready){
   expect(t.version).toBe(1)
   expect(componentRegistry.has(t.rootComponent!.definitionId+'@'+t.rootComponent!.definitionVersion)).toBe(true)
   if(t.kind==='cabinet')expect(initialSpecForTemplate(t.id,'pal18').templateVersion).toBe(1)
  }
  expect(()=>initialSpecForTemplate('drawer-unit','pal18')).toThrow('not available')
 })
 it('propagates parent width, thickness, depth and shelf indices through bindings',()=>{
  const spec=cabinetDefaults('pal18')
  const resolved=resolveComponentTree(createCabinetComponentTree(spec,18))
  expect(resolved.instance.definitionId).toBe('core/carcass')
  expect(resolved.children.map(c=>[c.values.width,c.values.depth,c.values.z]))
   .toEqual([[764,350,294],[764,350,588]])
  const resized={...spec,width:1000,height:1200,depth:450,sideClear:5,frontClear:12,rearClear:8}
  const result=resolveComponentTree(createCabinetComponentTree(resized,16))
  expect(result.children.map(c=>[c.values.x,c.values.width,c.values.depth]))
   .toEqual([[21,958,430],[21,958,430]])
  expect(cabinetBoxes(resized,16).filter(b=>b.role==='Shelf').map(b=>[b.dx,b.dy]))
   .toEqual([[958,430],[958,430]])
 })
 it('preserves unaffected node IDs on edits without linking distinct furniture copies',()=>{
  const spec=cabinetDefaults('pal18')
  const first=createCabinetComponentTree(spec,18)
  const revised=createCabinetComponentTree({...spec,width:950,shelves:3},18,first)
  expect(revised.id).toBe(first.id)
  expect(revised.children.slice(0,2).map(c=>c.id)).toEqual(first.children.map(c=>c.id))
  expect(revised.children[2].id).not.toBe(first.children[0].id)
  expect(resolveComponentTree(revised).children[0].values.width).toBe(914)
  expect(resolveComponentTree(first).children[0].values.width).toBe(764)
  const separate=createCabinetComponentTree(spec,18)
  expect(separate.id).not.toBe(first.id)
  expect(separate.children[0].id).not.toBe(first.children[0].id)
 })
 it('saves a tree alongside the assembled cutlist and preserves it through JSON',()=>{
  const project=createProject(),spec=cabinetDefaults(project.materials[0].id)
  const built=createCabinetForProject(project,spec)
  project.parts.push(...built.parts);project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  expect(project.assemblies[0].componentTree?.children).toHaveLength(2)
  expect(built.parts.find(part=>part.label==='Shelf')?.width).toBe(764)
  const restored=JSON.parse(JSON.stringify(project))
  expect(validateProject(restored)).toEqual([])
  expect(restored.assemblies[0].componentTree.children[0].bindings.width.parentKey).toBe('shelfWidth')
  const preset=createCabinetPreset(spec,project.materials[0])
  expect(preset.componentTree?.template).toEqual({id:'cabinet-open',version:1})
  expect(preset.componentTree?.id).not.toBe(project.assemblies[0].componentTree?.id)
  const originalId=project.assemblies[0].componentTree!.id
  const modified=reconfigureCabinet(project,project.assemblies[0].id,{...spec,width:1100,shelves:1})
  expect(modified.assemblies![0].componentTree?.id).toBe(originalId)
  expect(modified.assemblies![0].componentTree?.children).toHaveLength(1)
  expect(modified.parts.find(part=>part.label==='Shelf')?.width).toBe(1064)
  expect(project.parts.find(part=>part.label==='Shelf')?.width).toBe(764)
  expect(validateProject(modified)).toEqual([])
 })
 it('rejects unknown definition versions, duplicate IDs and invalid parent bindings',()=>{
  const tree=createCabinetComponentTree(cabinetDefaults('pal18'),18)
  tree.children[0].definitionVersion=999
  expect(()=>resolveComponentTree(tree)).toThrow('Unsupported component definition')
  tree.children[0].definitionVersion=1
  tree.children[1].id=tree.children[0].id
  expect(()=>resolveComponentTree(tree)).toThrow('Duplicate')
  tree.children[1].id=crypto.randomUUID()
  tree.children[1].bindings!.width.parentKey='nonexistent'
  expect(()=>resolveComponentTree(tree)).toThrow('Missing parent parameter')
 })
})
