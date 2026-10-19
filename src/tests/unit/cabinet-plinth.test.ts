import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetBoxes,cabinetDefaults,cabinetErrors,createCabinetForProject,reconfigureCabinet} from '../../furniture/cabinet.ts'
import {deriveFurnitureModel} from '../../furniture/furniture-model.ts'
import {detectPanelCollisions} from '../../furniture/geometry-diagnostics.ts'
import {createCabinetComponentTree} from '../../furniture/component-engine.ts'
import {initialSpecForTemplate} from '../../furniture/templates.ts'

describe('B24 recessed three-panel plinth',()=>{
 it('materializes genuine below-carcass support panels with matching 3D and cutlist',()=>{
  const project=createProject(),m=project.materials[0]
  for(const id of ['kitchen-base-panel-plinth','sideboard-doors-plinth']){
   const spec=initialSpecForTemplate(id,m.id),t=m.thickness
   const height=spec.plinthHeight??0,inset=spec.plinthInset??0
   expect(cabinetErrors(spec,m),id).toEqual([])
   const boxes=cabinetBoxes(spec,t)
   expect(detectPanelCollisions(boxes),id).toEqual([])
   const sides=boxes.filter(b=>b.role==='Plinth side')
   const front=boxes.find(b=>b.role==='Plinth front')
   expect(sides).toHaveLength(2)
   expect(sides.map(b=>[b.x,b.y,b.z,b.cutWidth,b.cutHeight]))
    .toEqual([[0,inset,-height,height,spec.depth-inset],
     [spec.width-t,inset,-height,height,spec.depth-inset]])
   expect(front).toMatchObject({x:t,y:inset,z:-height,
    dx:spec.width-2*t,dy:t,dz:height,
    cutWidth:spec.width-2*t,cutHeight:height})
   const made=createCabinetForProject(project,spec)
   const complete={...project,parts:made.parts,assemblies:made.assemblies}
   expect(validateProject(complete)).toEqual([])
   const model=deriveFurnitureModel(complete,made.assemblies[0])
   expect(model.diagnostics).toEqual([])
   expect(model.cutlist.reduce((n,p)=>n+p.quantity,0)).toBe(boxes.length)
   expect(model.solids).toHaveLength(boxes.length)
   expect(model.hardware.some(h=>h.label.startsWith('Panel-plinth'))).toBe(true)
  }
 })
 it('preserves base component identity through resize and rejects unsupported geometry',()=>{
  const project=createProject(),m=project.materials[0]
  const spec={...cabinetDefaults(m.id),plinthHeight:100,plinthInset:65}
  const original=createCabinetComponentTree(spec,m.thickness)
  const updated=createCabinetComponentTree({...spec,width:1010,plinthHeight:120},m.thickness,original)
  const getPlinthId=(tree:typeof original)=>tree.children.find(c=>c.definitionId==='core/plinth')?.id
  expect(getPlinthId(updated)).toBe(getPlinthId(original))
  const made=createCabinetForProject(project,spec)
  const saved={...project,parts:made.parts,assemblies:made.assemblies}
  const edited=reconfigureCabinet(saved,made.assemblies[0].id,{...spec,width:1010})
  expect(validateProject(edited)).toEqual([])
  expect(cabinetErrors({...spec,plinthHeight:40},m).join(' ')).toContain('height')
  expect(cabinetErrors({...spec,plinthInset:340},m).join(' ')).toContain('insufficient')
  expect(cabinetBoxes(cabinetDefaults(m.id),m.thickness).some(b=>b.role==='Plinth front')).toBe(false)
 })
})
