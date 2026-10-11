import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {validateProject} from '../../engine/schema.ts'
import {createCabinetForProject,createCabinetPreset,createCabinetParts,createCabinetAssemblies,cabinetBoxes,cabinetDefaults,cabinetErrors,reconfigureCabinet} from '../../furniture/cabinet.ts'
import {instantiatePreset} from '../../presets/presets.ts'
import {exportFusionPython} from '../../assembly/fusion.ts'

describe('parametric cabinet editor — parts, presets and Fusion',()=>{
 const create=()=>{const project=createProject();return {project,spec:cabinetDefaults(project.materials[0].id)}}
 it('builds exact 800 x 900 x 350 PAL 18mm cabinet with two shelves',()=>{
  const {project,spec}=create()
  const parts=createCabinetParts(spec,project.materials[0])
  expect(parts.map(p=>[p.label,p.width,p.height,p.quantity])).toEqual([
   ['Side panel',900,350,2],['Top / bottom',764,350,2],['Shelf',764,350,2]
  ])
  const boxes=cabinetBoxes(spec,18)
  expect(boxes).toHaveLength(6)
  expect(boxes.filter(p=>p.role==='Shelf').map(p=>p.z)).toEqual([294,588])
  const assembled=createCabinetForProject(project,spec)
  project.parts.push(...assembled.parts);project.assemblies=assembled.assemblies
  expect(project.assemblies[0].pieces).toHaveLength(6)
  expect(validateProject(project)).toEqual([])
  expect(exportFusionPython(project,project.assemblies[0])).toContain('Side panel')
 })
 it('handles 0,1,2,3 and 5 shelves without phantom panels',()=>{
  for(const count of [0,1,2,3,5]){
   const {project,spec}=create();spec.shelves=count
   const built=createCabinetForProject(project,spec)
   expect(built.assemblies[0].pieces).toHaveLength(4+count)
   expect(built.parts.reduce((n,p)=>n+p.quantity,0)).toBe(4+count)
   expect(built.parts.some(p=>p.label==='Shelf')).toBe(count>0)
  }
 })
 it('updates cut widths and shelf heights when width, depth, height or thickness changes',()=>{
  const {project,spec}=create()
  spec.width=1000;spec.height=1200;spec.depth=450
  const generated=createCabinetForProject(project,spec)
  expect(generated.parts.map(p=>[p.width,p.height,p.quantity])).toEqual([[1200,450,2],[964,450,2],[964,450,2]])
  expect(cabinetBoxes(spec,18).filter(x=>x.role==='Shelf').map(x=>x.z)).toEqual([394,788])
  const material={...project.materials[0],thickness:16}
  expect(createCabinetParts(spec,material).find(p=>p.label==='Top / bottom')?.width).toBe(968)
 })
 it('rejects invalid geometry before saving',()=>{
  const {project,spec}=create()
  spec.height=90;spec.shelves=5
  expect(cabinetErrors(spec,project.materials[0]).join(' ')).toContain('clear compartment')
  expect(()=>createCabinetForProject(project,spec)).toThrow()
  spec.height=900;spec.width=35
  expect(cabinetErrors(spec,project.materials[0]).join(' ')).toContain('Width')
 })
 it('presets insert into projects without mutating stored preset or old instances',()=>{
  const {project,spec}=create()
  const preset=createCabinetPreset(spec,project.materials[0])
  const raw=JSON.stringify(preset)
  const one=instantiatePreset(preset,project,2)
  const resolved={...preset.cabinetSpec!,materialId:project.materials[0].id}
  const assemblies=createCabinetAssemblies(resolved,project.materials[0],one,2,0)
  expect(assemblies.map(a=>a.pieces.length)).toEqual([6,6])
  expect(assemblies[0].pieces[0].instanceIndex).toBe(0)
  expect(assemblies[1].pieces[0].instanceIndex).toBe(2)
  expect(JSON.stringify(preset)).toBe(raw)
  project.parts.push(...one);project.assemblies=assemblies
  expect(validateProject(project)).toEqual([])
 })
 it('edits only the chosen cabinet and removes stale shelf rows',()=>{
  const {project,spec}=create()
  const first=createCabinetForProject(project,spec)
  project.parts.push(...first.parts);project.assemblies=first.assemblies
  const other={...spec,label:'Other cabinet',width:600}
  const second=createCabinetForProject(project,other)
  project.parts.push(...second.parts);project.assemblies.push(...second.assemblies)
  const originalOther=JSON.stringify(second.assemblies[0])
  const update={...spec,width:1000,shelves:0}
  const revised=reconfigureCabinet(project,first.assemblies[0].id,update)
  expect(revised.assemblies).toHaveLength(2)
  expect(JSON.stringify(revised.assemblies![1])).toBe(originalOther)
  expect(revised.assemblies![0].pieces).toHaveLength(4)
  expect(revised.parts.filter(p=>p.group==='Open cabinet').map(p=>p.quantity)).toEqual([2,2])
  expect(revised.parts.find(p=>p.group==='Open cabinet'&&p.label==='Top / bottom')?.width).toBe(964)
  expect(validateProject(revised)).toEqual([])
  expect(project.parts).toHaveLength(6)
  expect(project.assemblies![0].pieces).toHaveLength(6)
 })
 it('supports odd dimensions and fractional shelf positions in a saved assembly',()=>{
  const {project,spec}=create()
  spec.width=801;spec.height=901
  const built=createCabinetForProject(project,spec)
  project.parts.push(...built.parts);project.assemblies=built.assemblies
  expect(validateProject(project)).toEqual([])
  expect(built.assemblies[0].pieces.some(x=>x.positionMm.some(n=>!Number.isInteger(n)))).toBe(true)
 })
})
