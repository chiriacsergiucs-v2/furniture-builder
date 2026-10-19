import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetBoxes,cabinetDefaults,cabinetErrors,createCabinetForProject,createCabinetPreset,reconfigureCabinet} from '../../furniture/cabinet.ts'
import {createCabinetComponentTree} from '../../furniture/component-engine.ts'
import {detectPanelCollisions} from '../../furniture/geometry-diagnostics.ts'
import {deriveFurnitureModel} from '../../furniture/furniture-model.ts'
import {initialSpecForTemplate} from '../../furniture/templates.ts'

describe('B24 reusable applied backs and hinged door leaves',()=>{
 it('manufactures every new enclosed design with accurate placed panels and cutlist counts',()=>{
  const project=createProject(),m=project.materials[0]
  for(const id of ['kitchen-base-single-door','kitchen-wall-double-door','sideboard-closed-shelves']){
   const spec=initialSpecForTemplate(id,m.id)
   expect(cabinetErrors(spec,m),id).toEqual([])
   const boxes=cabinetBoxes(spec,m.thickness)
   expect(detectPanelCollisions(boxes),id).toEqual([])
   const panel=boxes.find(b=>b.role==='Applied back')
   expect(panel).toMatchObject({x:0,y:spec.depth,z:0,dx:spec.width,dy:m.thickness,dz:spec.height})
   const doors=boxes.filter(b=>b.role==='Hinged door')
   expect(doors).toHaveLength(spec.frontDoors==='double'?2:1)
   expect(doors.every(b=>b.y===-m.thickness&&b.z===2&&b.dz===spec.height-4)).toBe(true)
   const built=createCabinetForProject(project,spec)
   const instance={...project,parts:built.parts,assemblies:built.assemblies}
   expect(validateProject(instance),id).toEqual([])
   const model=deriveFurnitureModel(instance,built.assemblies[0])
   expect(model.diagnostics,id).toEqual([])
   expect(model.solids).toHaveLength(boxes.length)
   expect(model.cutlist.reduce((n,p)=>n+p.quantity,0)).toBe(boxes.length)
   expect(model.hardware.some(h=>h.label.startsWith('Hinge fitting set')&&h.quantity===doors.length)).toBe(true)
   expect(createCabinetPreset(spec,m).componentTree?.template?.id).toBe(id)
  }
 })
 it('keeps correct 3 mm center-gap geometry at odd widths and stable front/back instance IDs on resizing',()=>{
  const project=createProject(),m=project.materials[0]
  const spec={...cabinetDefaults(m.id),width:801,height:899,depth:401,shelves:1,
   backPanel:true,frontDoors:'double' as const}
  const panels=cabinetBoxes(spec,m.thickness).filter(b=>b.role==='Hinged door')
  expect(panels.map(p=>p.cutWidth)).toEqual([397,397])
  expect(panels[1].x-(panels[0].x+panels[0].dx)).toBe(3)
  const first=createCabinetComponentTree(spec,m.thickness)
  const update=createCabinetComponentTree({...spec,width:900},m.thickness,first)
  for(const type of ['core/back-panel','core/hinged-door']){
   const prev=first.children.filter(c=>c.definitionId===type)
   const next=update.children.filter(c=>c.definitionId===type)
   expect(next.map(c=>c.id)).toEqual(prev.map(c=>c.id))
  }
  const built=createCabinetForProject(project,spec)
  const edited=reconfigureCabinet({...project,parts:built.parts,assemblies:built.assemblies},
   built.assemblies[0].id,{...spec,width:900})
  expect(edited.assemblies?.[0].componentTree?.children).toBeDefined()
  expect(validateProject(edited)).toEqual([])
 })
 it('rejects door overlays across drawers and leaves old designs without invented panels',()=>{
  const p=createProject(),m=p.materials[0]
  const legacy=cabinetDefaults(m.id)
  expect(cabinetBoxes(legacy,m.thickness)).toHaveLength(6)
  expect(cabinetErrors({...legacy,frontDoors:'single',drawers:2,shelves:0},m).join(' ')).toContain('cannot cover drawer fronts')
  expect(cabinetErrors({...legacy,backPanel:true,frontDoors:'invalid' as 'double'},m).join(' ')).toContain('Unsupported door')
  const built=createCabinetForProject(p,legacy)
  expect(built.assemblies[0].componentTree?.children).toHaveLength(2)
 })
})
