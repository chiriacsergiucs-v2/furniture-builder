import {describe,it,expect} from 'vitest'
import {Euler,Matrix4,MathUtils} from 'three'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetBoxes,createCabinetForProject,createCabinetPreset,reconfigureCabinet} from '../../furniture/cabinet.ts'
import {drawerDefaults,drawerPanels,createDrawerForProject} from '../../furniture/drawer.ts'
import {createDrawerComponentTree,resolveComponentTree} from '../../furniture/component-engine.ts'
import {furnitureTemplates,initialSpecForTemplate} from '../../furniture/templates.ts'
import {deriveFurnitureModel,cabinetDrawerCount} from '../../furniture/furniture-model.ts'

const close=(a:number,b:number)=>expect(Math.abs(a-b)).toBeLessThan(1e-5)
function worldExtents(width:number,height:number,thickness:number,angles:[number,number,number]){
 const matrix=new Matrix4().makeRotationFromEuler(new Euler(...angles.map(MathUtils.degToRad) as [number,number,number],'XYZ'))
 const e=matrix.elements,v=[width,height,thickness]
 return [0,1,2].map(i=>v.reduce((sum,len,j)=>sum+Math.abs(e[j*4+i])*len,0))
}

describe('Manufacturing and rendered geometry parity B16/B17/B21/B28',()=>{
 it('builds all five chest recipes from shared drawer and carcass components',()=>{
  const project=createProject(),material=project.materials[0]
  const chests=furnitureTemplates.filter(t=>t.id.startsWith('chest-'))
  expect(chests).toHaveLength(5)
  const layouts=new Set<string>()
  for(const template of chests){
   expect(template.status).toBe('ready')
   const spec=initialSpecForTemplate(template.id,material.id)
   expect(spec.templateId).toBe(template.id)
   expect(spec.templateVersion).toBe(1)
   const built=createCabinetForProject(project,spec)
   expect(built.parts.length).toBeGreaterThan(4)
   const instance={...project,parts:built.parts,assemblies:built.assemblies}
   expect(validateProject(instance)).toEqual([])
   const model=deriveFurnitureModel(instance,built.assemblies[0])
   expect(model.diagnostics).toEqual([])
   expect(model.solids.length).toBe(built.parts.reduce((sum,p)=>sum+p.quantity,0))
   expect(model.cutlist.reduce((sum,r)=>sum+r.quantity,0)).toBe(model.solids.length)
   expect(model.hardware.filter(h=>h.unit==='pair').reduce((sum,r)=>sum+r.quantity,0))
    .toBe(cabinetDrawerCount(spec))
   expect(model.solids.some(piece=>piece.part.label.includes('Drawer side'))).toBe(true)
   const preset=createCabinetPreset(spec,material)
   expect(preset.componentTree?.template?.id).toBe(template.id)
   layouts.add(JSON.stringify([spec.drawers,spec.split?.axis,
    spec.split?.first.content,spec.split?.first.count,spec.split?.second.content,spec.split?.second.count]))
  }
  expect(layouts.size).toBe(5)
 })
 it('models the drawer front as an independent versioned child with inherited dimensions',()=>{
  const project=createProject(),material=project.materials[0]
  const options=['applied','lowered','none'] as const
  for(const front of options){
   const spec={...drawerDefaults(material.id),front}
   const tree=resolveComponentTree(createDrawerComponentTree(spec,material.thickness))
   const child=tree.children[0]
   expect(child.instance.definitionId).toBe('core/drawer-front')
   expect(child.instance.slot).toBe('front.main')
   expect(child.values.openingWidth).toBe(spec.openingWidth)
   expect(child.values.bodyHeight).toBe(spec.openingHeight-spec.upperClearance)
   const panels=drawerPanels(spec,material)
   expect(panels.find(p=>p.role==='Drawer front')?.cutHeight).toBe(child.values.innerFrontHeight)
   expect(panels.some(p=>p.role==='Applied front')).toBe(front==='applied')
   if(front==='applied')expect(panels.find(p=>p.role==='Applied front')?.cutWidth).toBe(child.values.appliedFrontWidth)
  }
  const a=createDrawerComponentTree(drawerDefaults(material.id),material.thickness)
  const b=createDrawerComponentTree({...drawerDefaults(material.id),front:'lowered'},material.thickness,a)
  expect(b.children[0].id).toBe(a.children[0].id)
 })
 it('preserves physical rectangular extents of every rendered cabinet solid',()=>{
  const project=createProject(),material=project.materials[0]
  const sources=furnitureTemplates.filter(t=>t.status==='ready'&&t.kind==='cabinet')
  for(const template of sources){
   const spec=initialSpecForTemplate(template.id,material.id)
   const built=createCabinetForProject(project,spec)
   const model=deriveFurnitureModel({...project,parts:built.parts,assemblies:built.assemblies},built.assemblies[0])
   const expected=cabinetBoxes(spec,material.thickness)
   expect(model.solids).toHaveLength(expected.length)
   for(let i=0;i<expected.length;i++){
    const box=expected[i],solid=model.solids[i]
    const span=worldExtents(solid.part.width,solid.part.height,solid.material.thickness,solid.instance.rotationDeg)
    close(span[0],box.dx);close(span[1],box.dz);close(span[2],box.dy)
   }
  }
 })
 it('keeps two copies independently editable and serializable without migrating legacy documents',()=>{
  const project=createProject(),material=project.materials[0]
  const spec=initialSpecForTemplate('chest-3-drawer',material.id)
  const one=createCabinetForProject(project,spec)
  project.parts=one.parts;project.assemblies=one.assemblies
  const before=structuredClone(project)
  const updated=reconfigureCabinet(project,one.assemblies[0].id,{...spec,width:1000})
  expect(updated.assemblies?.[0].componentTree?.id).toBe(one.assemblies[0].componentTree?.id)
  expect(before.parts.find(p=>p.label==='Drawer back')?.width).not.toBe(updated.parts.find(p=>p.label==='Drawer back')?.width)
  expect(validateProject(JSON.parse(JSON.stringify(updated)))).toEqual([])
  const legacy=structuredClone(project)
  delete legacy.assemblies?.[0].componentTree
  delete legacy.assemblies?.[0].cabinetSpec
  expect(validateProject(legacy)).toEqual([])
 })
 it('reports missing or malformed part allocations rather than inventing manufacturing rows',()=>{
  const project=createProject(),material=project.materials[0]
  const built=createDrawerForProject(project,drawerDefaults(material.id))
  const broken={...project,parts:built.parts.slice(1),assemblies:built.assemblies}
  const model=deriveFurnitureModel(broken,built.assemblies[0])
  expect(model.diagnostics.some(d=>d.includes('unresolved'))).toBe(true)
  expect(model.cutlist.reduce((sum,row)=>sum+row.quantity,0)).toBeLessThan(
   built.assemblies[0].pieces.length)
 })
})
