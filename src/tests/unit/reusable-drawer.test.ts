import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {cabinetDefaults,createCabinetForProject} from '../../furniture/cabinet.ts'
import {createCabinetComponentTree,createDrawerComponentTree,insertComponent,resolveComponentTree} from '../../furniture/component-engine.ts'
import {drawerDefaults,drawerErrors,drawerPanels,drawerParts,createDrawerForProject,createDrawerPreset,createDrawerAssemblies,reconfigureDrawer} from '../../furniture/drawer.ts'
import {instantiatePreset,validatePreset} from '../../presets/presets.ts'

describe('Reusable drawer components, runner clearances and insertion',()=>{
 it('calculates side-mounted drawer box, applied front and bottom as real parts',()=>{
  const project=createProject(),material=project.materials[0]
  const spec=drawerDefaults(material.id)
  expect(drawerErrors(spec,material)).toEqual([])
  const panels=drawerPanels(spec,material)
  expect(panels).toHaveLength(6)
  expect(panels.filter(p=>p.role==='Drawer side').map(p=>[p.cutWidth,p.cutHeight])).toEqual([[400,244],[400,244]])
  expect(panels.find(p=>p.role==='Drawer back')?.cutWidth).toBe(702)
  expect(panels.find(p=>p.role==='Drawer bottom')?.cutWidth).toBe(702)
  expect(panels.find(p=>p.role==='Drawer bottom')?.cutHeight).toBe(364)
  expect(panels.find(p=>p.role==='Applied front')).toMatchObject({cutWidth:760,cutHeight:246})
  const built=createDrawerForProject(project,spec)
  expect(built.parts.map(p=>p.quantity)).toEqual([2,1,1,1,1])
  expect(built.assemblies[0].pieces).toHaveLength(6)
  project.parts.push(...built.parts);project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
 })
 it('supports lowered finger-pull fronts, no applied front and custom runner space',()=>{
  const material=createProject().materials[0],base=drawerDefaults(material.id)
  const lowered={...base,front:'lowered' as const,pullGap:30,runner:'custom' as const,customSideClearance:15}
  const panels=drawerPanels(lowered,material)
  expect(panels).toHaveLength(5)
  expect(panels.find(p=>p.role==='Drawer front')?.cutHeight).toBe(214)
  expect(panels.find(p=>p.role==='Drawer back')?.cutWidth).toBe(698)
  expect(drawerPanels({...base,front:'none'},material).length).toBe(5)
  expect(drawerErrors({...lowered,pullGap:4},material)).toEqual(expect.arrayContaining([expect.stringContaining('finger gap')]))
 })
 it('prevents false verified fits for incompatible undermount thickness or nominal lengths',()=>{
  const material=createProject().materials[0],base=drawerDefaults(material.id)
  const under={...base,runner:'blum-movento' as const}
  expect(drawerErrors(under,material).join(' ')).toContain('at most 16 mm')
  const thin={...material,id:'p16',thickness:16},approved={...under,materialId:'p16'}
  expect(drawerErrors(approved,thin)).toEqual([])
  expect(drawerPanels(approved,thin).find(p=>p.role==='Drawer side')?.x).toBe(21)
  expect(drawerPanels(approved,thin).find(p=>p.role==='Drawer side')?.cutWidth).toBe(390)
  expect(drawerErrors({...base,runnerLength:480},material).join(' ')).toContain('Runner length')
 })
 it('duplicates preset drawers into independent positioned assemblies without mutating source',()=>{
  const project=createProject(),material=project.materials[0],spec=drawerDefaults(material.id)
  const preset=createDrawerPreset(spec,material)
  expect(validatePreset(preset)).toEqual([])
  const original=JSON.stringify(preset)
  const parts=instantiatePreset(preset,project,2)
  const assemblies=createDrawerAssemblies(spec,material,parts,2)
  project.parts=parts;project.assemblies=assemblies
  expect(assemblies.map(a=>a.pieces.length)).toEqual([6,6])
  expect(assemblies[1].pieces[0].instanceIndex).toBe(2)
  expect(assemblies[1].componentTree?.id).not.toBe(assemblies[0].componentTree?.id)
  expect(JSON.stringify(preset)).toBe(original)
  expect(validateProject(project)).toEqual([])
  const edited=reconfigureDrawer(project,assemblies[0].id,{...spec,openingWidth:900})
  expect(edited.assemblies?.[1].pieces.map(p=>p.positionMm)).toEqual(assemblies[1].pieces.map(p=>p.positionMm))
  expect(edited.assemblies?.[1].pieces[0].instanceIndex).toBe(0)
  expect(project.assemblies[1].pieces[0].instanceIndex).toBe(2)
  expect(edited.assemblies?.[0].componentTree?.id).toBe(assemblies[0].componentTree?.id)
  expect(validateProject(edited)).toEqual([])
 })
 it('inserts and repeats drawer children into a cabinet through parent dimensions',()=>{
  const project=createProject(),spec={...cabinetDefaults(project.materials[0].id),shelves:0,drawers:2,
   drawerConfig:{...drawerDefaults(project.materials[0].id),runnerLength:300}}
  const built=createCabinetForProject(project,spec)
  expect(built.assemblies[0].pieces).toHaveLength(16)
  expect(built.parts.find(p=>p.label==='Drawer side')?.quantity).toBe(4)
  expect(built.parts.find(p=>p.label==='Drawer side')?.width).toBe(300)
  expect(built.parts.find(p=>p.label==='Drawer back')?.width).toBe(702)
  expect(built.assemblies[0].componentTree?.children).toHaveLength(2)
  project.parts=built.parts;project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  const larger={...spec,width:1000}
  const big=createCabinetForProject(createProject(),larger)
  expect(big.parts.find(p=>p.label==='Drawer back')?.width).toBe(902)
  const root=createCabinetComponentTree(cabinetDefaults(project.materials[0].id),18)
  const drawer=createDrawerComponentTree(drawerDefaults(project.materials[0].id),18)
  expect(()=>insertComponent(root,'bad.slot',drawer)).toThrow('Incompatible component')
  const added=insertComponent({...root,children:[]},'interior.main',drawer)
  expect(resolveComponentTree(added).children[0].values.bodyWidth).toBe(738)
  expect(root.children).toHaveLength(2)
 })
})
