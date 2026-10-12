import {describe,it,expect} from 'vitest'
import {Euler,Matrix4,MathUtils} from 'three'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {surfaceErrors,surfacePanels,surfaceForProject,surfacePreset,surfaceAssemblies} from '../../furniture/surface.ts'
import {initialSurfaceSpecForTemplate,furnitureTemplates} from '../../furniture/templates.ts'
import {deriveFurnitureModel} from '../../furniture/furniture-model.ts'
import {detectPanelCollisions} from '../../furniture/geometry-diagnostics.ts'
import {instantiatePreset} from '../../presets/presets.ts'
const expected=[
 'desk-gable','desk-four-supports','desk-trestle','desk-pedestal-left','desk-two-pedestals',
 'table-coffee','table-four-supports','table-trestle','table-console','table-two-pedestals'
]
function extents(w:number,h:number,t:number,rot:[number,number,number]):number[]{
 const e=new Matrix4().makeRotationFromEuler(new Euler(...rot.map(MathUtils.degToRad) as [number,number,number],'XYZ')).elements
 return [0,1,2].map(i=>[w,h,t].reduce((a,v,j)=>a+Math.abs(e[j*4+i])*v,0))
}
describe('B24 distinct worktop and support generator',()=>{
 it('builds all ten independently versioned desk/table recipes',()=>{
  const project=createProject(),m=project.materials[0]
  const selected=furnitureTemplates.filter(t=>t.kind==='surface'&&t.status==='ready')
  expect(selected.map(t=>t.id)).toEqual(expected)
  const geometries=new Set<string>()
  for(const id of expected){
   const spec=initialSurfaceSpecForTemplate(id,m.id)
   expect(surfaceErrors(spec,m),id).toEqual([])
   const boxes=surfacePanels(spec,m)
   expect(boxes.length).toBeGreaterThan(2)
   expect(detectPanelCollisions(boxes.map(b=>({...b,role:'Side panel' as const}))),id).toEqual([])
   const built=surfaceForProject(project,spec)
   const complete={...project,parts:built.parts,assemblies:built.assemblies}
   expect(validateProject(complete),id).toEqual([])
   const model=deriveFurnitureModel(complete,built.assemblies[0])
   expect(model.diagnostics,id).toEqual([])
   expect(model.solids).toHaveLength(boxes.length)
   expect(model.cutlist.reduce((n,p)=>n+p.quantity,0)).toBe(boxes.length)
   for(let i=0;i<boxes.length;i++){
    const solid=model.solids[i]
    const world=extents(solid.part.width,solid.part.height,m.thickness,solid.instance.rotationDeg)
    const box=boxes[i]
    for(let j=0;j<3;j++)expect(Math.abs(world[j]-[box.dx,box.dz,box.dy][j])).toBeLessThan(1e-5)
   }
   const saved=surfacePreset(spec,m)
   expect(saved.surfaceSpec?.templateId).toBe(id)
   expect(saved.componentTree?.definitionId).toBe('core/surface')
   expect(saved.componentTree?.template?.id).toBe(id)
   expect(instantiatePreset(saved,project)).toHaveLength(built.parts.length)
   geometries.add(JSON.stringify([spec.layout,spec.width,spec.height,spec.depth]))
  }
  expect(geometries.size).toBe(10)
 })
 it('keeps copies independent and rejects unsafe dimensions or mismatched cutlists',()=>{
  const project=createProject(),m=project.materials[0]
  const spec=initialSurfaceSpecForTemplate('desk-trestle',m.id)
  const built=surfaceForProject(project,spec)
  const grouped=built.parts.map(part=>({...part,quantity:part.quantity*2}))
  const copies=surfaceAssemblies(spec,m,grouped,2)
  expect(copies).toHaveLength(2)
  expect(copies[0].id).not.toBe(copies[1].id)
  const complete={...project,parts:grouped,assemblies:copies}
  expect(validateProject(complete)).toEqual([])
  const wrong={...spec,width:100}
  expect(surfaceErrors(wrong,m).length).toBeGreaterThan(0)
  expect(()=>surfaceAssemblies(spec,m,built.parts.slice(1))).toThrow(/mismatch/)
 })
})
