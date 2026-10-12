import {useState} from 'react'
import type {Part,Project,Material} from '../engine/types.ts'
import type {StoredPreset} from '../db/database.ts'
import type {CutlistPreset,PresetItem} from '../presets/presets.ts'
import {presetMaterial,resolvePresetMaterial,validatePreset} from '../presets/presets.ts'
import {instantiateCustomizedPreset,customizeGeneratedPreset} from '../presets/customize.ts'
import {createCabinetPreset} from '../furniture/cabinet.ts'
import {createDrawerPreset} from '../furniture/drawer.ts'
import {CabinetConfigurator} from './CabinetConfigurator.tsx'
import {DrawerConfigurator} from './DrawerConfigurator.tsx'

interface Props {
 source:StoredPreset; project:Project
 onCancel:()=>void
 onInsert:(projectId:string,parts:Part[],presetId:string,copies:number,
  cabinetSpec?:NonNullable<StoredPreset['cabinetSpec']>,drawerSpec?:NonNullable<StoredPreset['drawerSpec']>)=>Promise<void>
}
const err=(e:unknown)=>e instanceof Error?e.message:String(e)
/** One-off, in-memory customization. Nothing is written to the preset library. */
export function PresetCustomization({source,project,onCancel,onInsert}:Props){
 const [draft,setDraft]=useState<CutlistPreset>(()=>structuredClone(source))
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const materials=project.materials
 const compatible=materials.find(m=>source.items[0]&&m.type===source.items[0].material.type&&
  m.thickness===source.items[0].material.thickness&&
  (m.finish??'')===(source.items[0].material.finish??''))??materials[0]
 const run=async(parts:Part[],cabinetSpec?:StoredPreset['cabinetSpec'],drawerSpec?:StoredPreset['drawerSpec'])=>{
  setSaving(true);setError('')
  try{await onInsert(project.id,parts,source.id,1,cabinetSpec,drawerSpec)}
  catch(e){setError(err(e));throw e}
  finally{setSaving(false)}
 }
 const withCabinet=async(spec:NonNullable<StoredPreset['cabinetSpec']>)=>{
  const material=materials.find(m=>m.id===spec.materialId)
  if(!material)throw Error('Selected material is unavailable.')
  const output=customizeGeneratedPreset(source,createCabinetPreset(spec,material))
  const parts=instantiateCustomizedPreset(source,output,project)
  await run(parts,spec)
 }
 const withDrawer=async(spec:NonNullable<StoredPreset['drawerSpec']>)=>{
  const material=materials.find(m=>m.id===spec.materialId)
  if(!material)throw Error('Selected material is unavailable.')
  const output=customizeGeneratedPreset(source,createDrawerPreset(spec,material))
  const parts=instantiateCustomizedPreset(source,output,project)
  await run(parts,undefined,spec)
 }
 const changeItem=(index:number,patch:Partial<PresetItem>)=>setDraft(p=>({
  ...p,items:p.items.map((item,i)=>i===index?{...item,...patch}:item)
 }))
 const submit=async()=>{
  const problems=validatePreset(draft)
  if(problems.length){setError(problems.join('; '));return}
  try{await run(instantiateCustomizedPreset(source,draft,project))}
  catch{/* The error is displayed without saving any preset. */}
 }
 const initialMaterial=()=>{
  if(!compatible)throw Error('A destination project material is required.')
  return compatible.id
 }
 if(!materials.length)return <section role="region" aria-label="Customize preset for project" className="card">
  <p role="alert">The destination project has no materials. Add one before customizing this preset.</p>
  <button onClick={onCancel}>Cancel</button>
 </section>
 const originalMaterial=source.items[0]?.material
 const matching=originalMaterial?(()=>{try{return resolvePresetMaterial(originalMaterial,materials)}catch{return compatible}})():compatible
 return <section role="region" aria-label="Customize preset for project" className="card">
  <div className="section-head"><div><h3>Customize for {project.name}</h3>
   <p className="muted">Source: {source.label} · revision {source.revision??1}. Unsaved changes belong only to this project.</p>
  </div><button type="button" onClick={onCancel}>Cancel</button></div>
  {error&&<p role="alert" className="preset-error">{error}</p>}
  {source.cabinetSpec?<CabinetConfigurator key={source.id} mode="item" materials={materials}
    initial={{...structuredClone(source.cabinetSpec),materialId:matching?.id??initialMaterial()}}
    onAdd={withCabinet} onCancel={onCancel}/>:
   source.drawerSpec?<DrawerConfigurator key={source.id} mode="item" materials={materials}
    initial={{...structuredClone(source.drawerSpec),materialId:matching?.id??initialMaterial()}}
    onAdd={withDrawer} onCancel={onCancel}/>:
   <div className="stack">
    <p className="muted">Change part dimensions, quantity or material, then explicitly add this version to the destination project. The original preset and its revision are unchanged.</p>
    {draft.items.map((item,i)=><div className="part-card" key={i}>
     <div className="form-grid">
      <label className="field"><span>Part name</span><input value={item.label} onChange={e=>changeItem(i,{label:e.target.value})}/></label>
      <label className="field"><span>Width mm</span><input type="number" min="1" step="1" value={item.width} onChange={e=>changeItem(i,{width:Number(e.target.value)})}/></label>
      <label className="field"><span>Height mm</span><input type="number" min="1" step="1" value={item.height} onChange={e=>changeItem(i,{height:Number(e.target.value)})}/></label>
      <label className="field"><span>Quantity</span><input type="number" min="1" step="1" value={item.quantity} onChange={e=>changeItem(i,{quantity:Number(e.target.value)})}/></label>
      <label className="field"><span>Material</span><select value={materials.find(m=>m.name===item.material.name&&m.thickness===item.material.thickness&&m.type===item.material.type)?.id??''}
       onChange={e=>{const material=materials.find(m=>m.id===e.target.value);if(material)changeItem(i,{material:presetMaterial(material)})}}>
       <option value="">Choose compatible material</option>
       {materials.map((m:Material)=><option value={m.id} key={m.id}>{m.name} · {m.thickness} mm</option>)}
      </select></label>
     </div>
     <details className="part-advanced"><summary>Advanced · grain and ABS</summary>
      <label className="field"><span>Grain</span><select value={item.grain} onChange={e=>changeItem(i,{grain:e.target.value as PresetItem['grain']})}>
       {['none','x','y'].map(axis=><option key={axis}>{axis}</option>)}
      </select></label>
      {(['top','right','bottom','left'] as const).map(side=><label className="field" key={side}><span>ABS {side}</span>
       <input value={item.abs[side]??''} onChange={e=>changeItem(i,{abs:{...item.abs,[side]:e.target.value||null}})}/></label>)}
     </details>
    </div>)}
    <div className="actions"><button className="primary" type="button" disabled={saving||validatePreset(draft).length>0}
     onClick={()=>void submit()}>{saving?'Adding…':'Add customized to project'}</button>
     <button type="button" onClick={onCancel}>Discard changes</button></div>
   </div>}
 </section>
}
