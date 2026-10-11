import {lazy,Suspense,useState} from 'react'
import type {Material,GrainAxis} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {PresetCategory} from '../db/database.ts'
import {download,fileSlug} from '../import-export/files.ts'
import {exportFusionPython} from '../assembly/fusion.ts'
import {cabinetDefaults,cabinetErrors,cabinetBoxes,createCabinetForProject} from '../furniture/cabinet.ts'
import type {CabinetSpec} from '../furniture/cabinet.ts'
const CabinetPreview=lazy(()=>import('./CabinetPreview.tsx'))

export function CabinetConfigurator({mode,materials,categories,initial,initialCategory,onAdd,onSavePreset,onCancel}:{
 mode:'item'|'preset';materials:Material[];categories?:PresetCategory[]
 initial?:CabinetSpec;initialCategory?:string
 onAdd?:(spec:CabinetSpec)=>Promise<void>|void
 onSavePreset?:(spec:CabinetSpec,categoryId:string)=>Promise<void>|void
 onCancel:()=>void
}){
 const [spec,setSpec]=useState<CabinetSpec>(()=>{
  const first=materials[0]?.id??''
  const candidate=initial??cabinetDefaults(first)
  return {...candidate,materialId:materials.some(m=>m.id===candidate.materialId)?candidate.materialId:first}
 })
 const [category,setCategory]=useState(initialCategory??'uncategorized')
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const material=materials.find(m=>m.id===spec.materialId)
 const errors=cabinetErrors(spec,material)
 const boxes=!errors.length&&material?cabinetBoxes(spec,material.thickness):[]
 const clear=material?(spec.height-(spec.shelves+2)*material.thickness)/(spec.shelves+1):0
 const inner=material?spec.width-2*material.thickness:0
 const rows=(['Side panel','Top / bottom','Shelf'] as const).flatMap(role=>{
  const group=boxes.filter(b=>b.role===role)
  return group.length?[{label:role,width:group[0].cutWidth,height:group[0].cutHeight,quantity:group.length}]:[]
 })
 const change=<K extends keyof CabinetSpec>(key:K,value:CabinetSpec[K])=>{setSpec(old=>({...old,[key]:value}));setError('')}
 const submit=async()=>{
  if(errors.length)return
  setSaving(true);setError('')
  try{
   if(mode==='item'){
    if(!onAdd)throw Error('Add-item destination is missing.')
    await onAdd(spec)
   }else{
    if(!onSavePreset)throw Error('Preset save action is missing.')
    await onSavePreset(spec,category)
   }
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 const exportFusion=()=>{
  if(errors.length||!material)return
  try{
   // Snapshot export through the existing project assembly exporter.
   const empty=createProject()
   const base={...empty,materials:[material],parts:[],assemblies:[]}
   const built=createCabinetForProject(base,spec)
   const project={...base,parts:built.parts,assemblies:built.assemblies}
   download(fileSlug(spec.label)+'-fusion.py',exportFusionPython(project,built.assemblies[0]),'text/x-python;charset=utf-8')
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 const field=(key:'width'|'height'|'depth'|'sideClear'|'frontClear'|'rearClear',label:string,min=0)=>
  <label className="field"><span>{label}</span><input type="number" step="1" min={min}
   value={spec[key]} onChange={e=>change(key,Number(e.target.value))}/></label>
 return <section className="card cabinet-wizard" role="region" aria-label={mode==='item'?'Add furniture item':'Create furniture preset'}>
  <div className="section-head"><div><h2>{mode==='item'?'Add furniture item':'Create furniture preset'}</h2>
   <p className="muted">Parametric open-front cabinet · all dimensions in mm · automatic cut list</p></div>
   <button type="button" onClick={onCancel}>Close editor</button>
  </div>
  <div className="cabinet-workspace">
   <div className="cabinet-form">
    <div className="cabinet-step">01 / Cabinet configuration</div>
    <label className="field"><span>{mode==='preset'?'Preset name':'Furniture item name'}</span>
     <input value={spec.label} maxLength={200} onChange={e=>change('label',e.target.value)}/></label>
    <div className="form-grid">
     {field('width','Overall width (mm)',1)}
     {field('height','Overall height (mm)',1)}
     {field('depth','Overall depth (mm)',1)}
    </div>
    <label className="field"><span>Board material and thickness</span>
     <select value={spec.materialId} onChange={e=>change('materialId',e.target.value)}>
      {materials.map(m=><option value={m.id} key={m.id}>{m.name} · {m.type} · {m.thickness} mm</option>)}
     </select></label>
    <div className="cabinet-shelf-picker">
     <div><strong>Internal shelves</strong><p className="muted">Equal clear openings, including zero shelves</p></div>
     <div className="cabinet-quantity">
      <button type="button" aria-label="Decrease shelves" disabled={spec.shelves===0} onClick={()=>change('shelves',Math.max(0,spec.shelves-1))}>−</button>
      <output aria-label="Shelf count">{spec.shelves}</output>
      <button type="button" aria-label="Increase shelves" disabled={spec.shelves===20} onClick={()=>change('shelves',Math.min(20,spec.shelves+1))}>+</button>
     </div>
    </div>
    <details className="cabinet-options"><summary>Advanced clearances and manufacturing</summary>
     <div className="form-grid">
      {field('sideClear','Shelf side clearance (mm)')}
      {field('frontClear','Shelf front clearance (mm)')}
      {field('rearClear','Shelf rear clearance (mm)')}
      <label className="field"><span>Grain direction</span>
       <select value={spec.grain} onChange={e=>change('grain',e.target.value as GrainAxis)}>
        <option value="none">Unspecified</option><option value="x">Along cut width</option><option value="y">Along cut height</option>
       </select></label>
     </div>
     <label className="checkline"><input type="checkbox" checked={spec.frontEdge}
      onChange={e=>change('frontEdge',e.target.checked)}/> Front-facing ABS edges</label>
    </details>
    {mode==='preset'&&<label className="field"><span>Preset category</span>
     <select value={category} onChange={e=>setCategory(e.target.value)}>
      {(categories??[]).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
     </select></label>}
   </div>
   <div className="cabinet-visual">
    <div className="cabinet-visual-head"><strong>02 / Live assembly preview</strong><small>Drag to orbit · scroll to zoom</small></div>
    {errors.length?<div className="cabinet-invalid" role="alert">{errors.map((err,i)=><p key={i}>{err}</p>)}</div>:
     <Suspense fallback={<div className="cabinet-no-webgl">Loading 3D preview…</div>}><CabinetPreview spec={spec} boxes={boxes}/></Suspense>}
    <div className="cabinet-stats">
     <div><small>Physical panels</small><strong>{boxes.length}</strong></div>
     <div><small>Internal width</small><strong>{inner} mm</strong></div>
     <div><small>Clear opening</small><strong>{Number.isFinite(clear)?Number(clear.toFixed(3)):0} mm</strong></div>
    </div>
    <div className="cabinet-step">03 / Manufacturing cut list</div>
    <div className="cabinet-cutlist-scroll"><table className="cabinet-cutlist">
     <thead><tr><th>Part</th><th>Cut size (mm)</th><th>Qty</th></tr></thead>
     <tbody>{rows.map(row=><tr key={row.label}><td>{row.label}</td><td>{row.width} × {row.height} × {material?.thickness}</td><td>{row.quantity}</td></tr>)}</tbody>
    </table></div>
   </div>
  </div>
  {error&&<p role="alert" className="preset-error">{error}</p>}
  <div className="cabinet-wizard-footer">
   <button type="button" onClick={onCancel}>Cancel</button>
   <button type="button" onClick={exportFusion} disabled={errors.length>0}>Export to Fusion 360 (.py)</button>
   <button type="button" className="primary" onClick={()=>void submit()} disabled={errors.length>0||saving}>
    {saving?'Saving…':mode==='item'?'Add item to project':'Save preset'}
   </button>
  </div>
  <p className="muted cabinet-export-note">Fusion export is a separately editable solid-component snapshot, not a live-linked .f3d file. Re-export after changing the cabinet.</p>
 </section>
}
