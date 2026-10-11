import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {
 cabinetDefaults,cabinetBoxes,cabinetErrors,createCabinetForProject,createCabinetPreset,
 createCabinetAssemblies,reconfigureCabinet,totalCabinetWidth
} from '../../furniture/cabinet.ts'
import type {CabinetSpec} from '../../furniture/cabinet.ts'
import {drawerDefaults} from '../../furniture/drawer.ts'
import {
 createCabinetComponentTree,repeatComponents,replaceComponent,resolveComponentTree,
 connectModules,createDrawerComponentTree
} from '../../furniture/component-engine.ts'

const base=()=>{const project=createProject(),spec=cabinetDefaults(project.materials[0].id)
 return {project,spec,material:project.materials[0]}
}
const split=(spec:CabinetSpec):CabinetSpec=>({...spec,shelves:0,
 drawerConfig:{...drawerDefaults(spec.materialId),runnerLength:300},
 split:{axis:'vertical',ratio:50,first:{content:'shelves',count:2},second:{content:'drawers',count:2}}})

describe('B08–B15: modular furniture composition and manufacturing',()=>{
 it('repeats shelf nodes with stable IDs, parent spacing and isolated changes',()=>{
  const {spec}=base()
  const original=createCabinetComponentTree(spec,18)
  const expanded=repeatComponents(original,'interior.main','core/shelf',3,(_,old)=>({
   ...(old??{...original.children[0],id:crypto.randomUUID(),children:[]})
  }))
  expect(original.children).toHaveLength(2)
  expect(expanded.children).toHaveLength(3)
  expect(expanded.params.shelves).toBe(3)
  expect(expanded.children[0].id).toBe(original.children[0].id)
  expect(resolveComponentTree(expanded).children.map(c=>c.values.z)).toEqual([225,432,639])
  expect(resolveComponentTree(original).children.map(c=>c.values.z)).toEqual([294,588])
 })
 it('replaces a shelf with a drawer in a single compatible bay without changing source',()=>{
  const {spec}=base()
  const parent=createCabinetComponentTree({...spec,shelves:1},18)
  const replacement=createCabinetComponentTree({...spec,shelves:0,drawers:1,
   drawerConfig:{...drawerDefaults(spec.materialId),runnerLength:300}},18).children[0]
  const result=replaceComponent(parent,parent.children[0].id,replacement)
  expect(result.children.map(c=>c.definitionId)).toEqual(['core/drawer'])
  expect(result.params).toMatchObject({shelves:0,drawers:1})
  expect(parent.children[0].definitionId).toBe('core/shelf')
  expect(resolveComponentTree(result).children[0].values.openingWidth).toBe(764)
  expect(()=>replaceComponent(parent,'absent',replacement)).toThrow('not found')
 })
 it('splits into left shelves/right drawers with true divider and distinct cut rows',()=>{
  const {project,spec,material}=base()
  const config=split(spec)
  expect(cabinetErrors(config,material)).toEqual([])
  const tree=resolveComponentTree(createCabinetComponentTree(config,18))
  expect(tree.children.map(c=>c.instance.definitionId)).toEqual(['core/compartment','core/compartment'])
  expect(tree.children[0].values.width).toBe(373)
  expect(tree.children[1].values.x).toBe(409)
  expect(tree.children[0].children.map(c=>c.instance.definitionId)).toEqual(['core/shelf','core/shelf'])
  expect(tree.children[1].children.map(c=>c.instance.definitionId)).toEqual(['core/drawer','core/drawer'])
  const built=createCabinetForProject(project,config)
  expect(built.assemblies[0].pieces).toHaveLength(19)
  expect(built.parts.find(p=>p.label==='Divider')?.quantity).toBe(1)
  expect(built.parts.find(p=>p.label==='Bay 1 · Shelf')?.width).toBe(373)
  expect(built.parts.find(p=>p.label==='Bay 2 · Drawer back')?.quantity).toBe(2)
  project.parts=built.parts;project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  expect(built.parts.reduce((n,p)=>n+p.quantity,0)).toBe(built.assemblies[0].pieces.length)
 })
 it('splits lower and upper bays and rejects compartment geometries that cannot fit',()=>{
  const {project,spec,material}=base()
  const config={...split(spec),split:{axis:'horizontal' as const,ratio:45,
   first:{content:'drawers' as const,count:1},second:{content:'shelves' as const,count:1}}}
  const panels=cabinetBoxes(config,18)
  const divider=panels.find(p=>p.role==='Divider')
  expect(divider).toMatchObject({dx:764,dz:18})
  const firstShelf=panels.find(p=>p.role==='Shelf')
  expect(firstShelf?.z).toBeGreaterThan(divider!.z+divider!.dz)
  const built=createCabinetForProject(project,config)
  expect(built.parts.reduce((n,p)=>n+p.quantity,0)).toBe(built.assemblies[0].pieces.length)
  expect(cabinetErrors({...config,split:{...config.split,ratio:10}},material).length).toBeGreaterThan(0)
 })
 it('positions custom shelves, checks ordering and retains saved presets',()=>{
  const {spec,material}=base()
  const custom:CabinetSpec={...spec,shelfMode:'custom',shelfPositions:[25,75]}
  const rows=cabinetBoxes(custom,18).filter(b=>b.role==='Shelf')
  expect(rows.map(b=>b.z)).toEqual([234,666])
  expect(createCabinetPreset(custom,material).cabinetSpec?.shelfPositions).toEqual([25,75])
  expect(cabinetErrors({...custom,shelfPositions:[75,25]},material)).toContain(
   'Custom shelf positions must be strictly increasing, 5–95%.')
 })
 it('docks a right-side carcass and generates a coherent two-module cutlist',()=>{
  const {project,spec}=base()
  const config={...spec,connected:{width:600,shelves:1,drawers:0}}
  const root=resolveComponentTree(createCabinetComponentTree(config,18))
  expect(root.instance.definitionId).toBe('core/module-group')
  expect(root.values.totalWidth).toBe(1400)
  expect(root.children[1].values.x).toBe(800)
  const boxes=cabinetBoxes(config,18)
  expect(boxes).toHaveLength(11)
  expect(totalCabinetWidth(config)).toBe(1400)
  expect(boxes.find(b=>b.label==='Module 2 · Side panel')?.x).toBe(800)
  const built=createCabinetForProject(project,config)
  expect(built.parts.some(p=>p.label==='Module 2 · Shelf')).toBe(true)
  expect(built.parts.reduce((n,p)=>n+p.quantity,0)).toBe(11)
  project.parts=built.parts;project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  expect(()=>connectModules(createDrawerComponentTree(drawerDefaults(spec.materialId),18),
   createCabinetComponentTree(spec,18))).toThrow('requires two carcass')
 })
 it('preserves module and bay identities on edits and supports independent preset copies',()=>{
  const {project,spec,material}=base()
  const original:CabinetSpec={...split(spec),connected:{width:600,shelves:2,drawers:0}}
  const built=createCabinetForProject(project,original)
  project.parts=built.parts;project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  const oldTree=project.assemblies[0].componentTree!
  const revised=reconfigureCabinet(project,built.assemblies[0].id,{...original,
   width:900,split:{...original.split!,ratio:60}})
  expect(revised.assemblies?.[0].componentTree?.id).toBe(oldTree.id)
  expect(validateProject(revised)).toEqual([])
  expect(JSON.stringify(project.assemblies[0].componentTree)).toBe(JSON.stringify(oldTree))
  const p=createCabinetPreset(original,material)
  const copiedParts=p.items.map(item=>({
   id:crypto.randomUUID(),label:item.label,width:item.width,height:item.height,
   materialId:material.id,quantity:item.quantity*2,rotationAllowed:item.rotationAllowed,
   grain:item.grain,abs:item.abs
  }))
  const copies=createCabinetAssemblies(original,material,copiedParts,2)
  expect(copies).toHaveLength(2)
  expect(copies.map(a=>a.pieces.length)).toEqual([built.assemblies[0].pieces.length,built.assemblies[0].pieces.length])
  expect(copies[0].componentTree?.id).not.toBe(copies[1].componentTree?.id)
 })
})
