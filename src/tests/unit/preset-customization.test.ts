import {describe,it,expect} from 'vitest'
import {createProject} from '../../engine/types.ts'
import {createPreset,instantiatePreset,presetMaterial} from '../../presets/presets.ts'
import {instantiateCustomizedPreset,customizeGeneratedPreset} from '../../presets/customize.ts'
import {cabinetDefaults,createCabinetPreset} from '../../furniture/cabinet.ts'
import {drawerDefaults,createDrawerPreset} from '../../furniture/drawer.ts'
import type {StoredPreset} from '../../db/database.ts'

describe('B22 project-only customization with immutable library originals',()=>{
 const savedManual=():StoredPreset=>{
  const project=createProject(),material=project.materials[0]
  return {...createPreset('Shelf module',[{
   label:'Shelf',width:600,height:300,quantity:2,
   material:presetMaterial(material),rotationAllowed:true,grain:'none',
   abs:{top:null,right:null,bottom:null,left:null}
  }]),revision:4,categoryId:'uncategorized'}
 }
 it('edits manual rows in a draft but pins original source revision without writing a new preset',()=>{
  const project=createProject(),saved=savedManual()
  const draft=structuredClone(saved)
  draft.items[0].width=700;draft.items[0].quantity=3
  const generated=instantiateCustomizedPreset(saved,draft,project)
  expect(generated).toHaveLength(1)
  expect(generated[0].width).toBe(700)
  expect(generated[0].quantity).toBe(3)
  expect(generated[0].sourcePreset).toMatchObject({id:saved.id,revision:4})
  expect(saved.items[0].width).toBe(600)
  expect(saved.items[0].quantity).toBe(2)
  expect(instantiatePreset(saved,project)[0].width).toBe(600)
  expect(generated[0].id).not.toBe(instantiatePreset(saved,project)[0].id)
  expect(()=>instantiateCustomizedPreset(saved,{...draft,id:'unrelated'},project)).toThrow(/source preset ID/)
 })
 it('regenerates registered cabinet and drawer geometry, preserving source identity',()=>{
  const project=createProject(),material=project.materials[0]
  const cabinetSource={...createCabinetPreset(cabinetDefaults(material.id),material),categoryId:'uncategorized',revision:3}
  const variant={...cabinetDefaults(material.id),width:1000,label:'One-project cabinet'}
  const cabinetDraft=customizeGeneratedPreset(cabinetSource,createCabinetPreset(variant,material))
  const cabinetParts=instantiateCustomizedPreset(cabinetSource,cabinetDraft,project)
  expect(cabinetParts).not.toHaveLength(0)
  expect(cabinetParts.every(p=>p.sourcePreset?.id===cabinetSource.id&&p.sourcePreset.revision===3)).toBe(true)
  expect(cabinetSource.cabinetSpec?.width).toBe(800)
  expect(cabinetDraft.cabinetSpec?.width).toBe(1000)
  const drawerSource={...createDrawerPreset(drawerDefaults(material.id),material),categoryId:'uncategorized',revision:2}
  const drawerDraft=customizeGeneratedPreset(drawerSource,createDrawerPreset({...drawerDefaults(material.id),label:'Fitted copy',openingWidth:800},material))
  expect(instantiateCustomizedPreset(drawerSource,drawerDraft,project)[0].sourcePreset?.revision).toBe(2)
  expect(drawerSource.drawerSpec?.openingWidth).toBe(764)
  expect(()=>customizeGeneratedPreset(drawerSource,createCabinetPreset(variant,material))).toThrow(/generator kind/)
 })
})
