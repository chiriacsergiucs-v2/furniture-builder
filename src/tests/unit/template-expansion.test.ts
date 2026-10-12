import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetErrors,cabinetBoxes,createCabinetForProject,createCabinetPreset} from '../../furniture/cabinet.ts'
import {deriveFurnitureModel} from '../../furniture/furniture-model.ts'
import {detectPanelCollisions} from '../../furniture/geometry-diagnostics.ts'
import {furnitureTemplates,initialSpecForTemplate} from '../../furniture/templates.ts'

const ids=[
 'kitchen-base-open','kitchen-wall-open','pantry-open','bookcase-two-bay',
 'nightstand-two-drawer','shoe-storage-open','media-two-bay-open','media-drawer-bay',
 'sideboard-mixed','connected-cubby'
] as const

describe('B24: ten additional buildable furniture layouts',()=>{
 it('has explicit recipes across useful furniture categories, without advertising planned ideas as ready',()=>{
  expect(ids).toHaveLength(10)
  const selected=ids.map(id=>furnitureTemplates.find(t=>t.id===id))
  expect(selected.every(t=>t?.status==='ready'&&t.kind==='cabinet'&&t.rootComponent?.definitionId==='core/carcass')).toBe(true)
  expect(new Set(selected.map(t=>t?.category)).size).toBeGreaterThanOrEqual(5)
  for(const id of ['wardrobe','desk','tv-unit']){
   expect(furnitureTemplates.find(t=>t.id===id)?.status).toBe('planned')
  }
 })
 it('generates dimensioned, nonintersecting, independent cutlists and 3D solids for every new recipe',()=>{
  const project=createProject(),material=project.materials[0]
  const signatures=new Set<string>()
  for(const id of ids){
   const recipe=initialSpecForTemplate(id,material.id)
   expect(cabinetErrors(recipe,material),id).toEqual([])
   const boxes=cabinetBoxes(recipe,material.thickness)
   expect(detectPanelCollisions(boxes),id).toEqual([])
   const built=createCabinetForProject(project,recipe)
   const complete={...project,parts:built.parts,assemblies:built.assemblies}
   expect(validateProject(complete),id).toEqual([])
   const derived=deriveFurnitureModel(complete,built.assemblies[0])
   expect(derived.diagnostics,id).toEqual([])
   expect(derived.solids).toHaveLength(boxes.length)
   expect(derived.cutlist.reduce((n,row)=>n+row.quantity,0)).toBe(boxes.length)
   expect(built.parts.every(part=>Number.isSafeInteger(part.width)&&Number.isSafeInteger(part.height)&&part.width>0&&part.height>0)).toBe(true)
   const preset=createCabinetPreset(recipe,material)
   expect(preset.componentTree?.template).toEqual({id,version:1})
   const copy=structuredClone(preset)
   expect(copy.items).toEqual(preset.items)
   signatures.add(JSON.stringify([recipe.width,recipe.height,recipe.depth,recipe.split,recipe.drawers,recipe.shelves,recipe.connected]))
  }
  expect(signatures.size).toBe(ids.length)
 })
})
