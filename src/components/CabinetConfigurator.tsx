import {lazy,Suspense,useState} from 'react'
import type {Material,GrainAxis} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {PresetCategory} from '../db/database.ts'
import {download,fileSlug} from '../import-export/files.ts'
import {exportFusionPython} from '../assembly/fusion.ts'
import {cabinetErrors,cabinetBoxes,createCabinetForProject} from '../furniture/cabinet.ts'
import type {CabinetSpec} from '../furniture/cabinet.ts'
import {furnitureTemplates,initialSpecForTemplate} from '../furniture/templates.ts'
import type {FurnitureTemplate} from '../furniture/templates.ts'

const CabinetPreview=lazy(()=>import('./CabinetPreview.tsx'))
type Stage=0|1|2
const steps=['Choose template','Customize','Review & save'] as const

export function CabinetConfigurator({mode,materials,categories,initial,initialCategory,editing=false,onAdd,onSavePreset,onCancel}:{
 mode:'item'|'preset';materials:Material[];categories?:PresetCategory[];editing?:boolean
 initial?:CabinetSpec;initialCategory?:string
 onAdd?:(spec:CabinetSpec)=>Promise<void>|void
 onSavePreset?:(spec:CabinetSpec,categoryId:string)=>Promise<void>|void
 onCancel:()=>void
}){
 const [spec,setSpec]=useState<CabinetSpec>(()=>{
  const first=materials[0]?.id??''
  const candidate=initial??initialSpecForTemplate('cabinet-open',first)
  return {...candidate,materialId:materials.some(m=>m.id===candidate.materialId)?candidate.materialId:first}
 })
 const [stage,setStage]=useState<Stage>(initial?1:0)
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
 const selectTemplate=(template:FurnitureTemplate)=>{
  if(template.status!=='ready')return
  setSpec(initialSpecForTemplate(template.id,spec.materialId))
  setError('')
 }
 const next=()=>{
  if(stage===0){setStage(1);return}
  if(stage===1&&errors.length===0)setStage(2)
 }
 const submit=async()=>{
  if(errors.length||stage!==2)return
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
 return <section className="card cabinet-wizard" role="region"
  aria-label={mode==='item'?(editing?'Edit furniture item':'Add furniture item'):'Create furniture preset'}>
  <div className="section-head"><div>
   <h2>{mode==='item'?(editing?'Edit furniture item':'Add furniture item'):'Create furniture preset'}</h2>
   <p className="muted">Template-based furniture design · mm · live assembled preview</p>
  </div><button type="button" onClick={onCancel}>Close editor</button></div>
  <nav className="furniture-steps" aria-label="Furniture creation progress">
   {steps.map((name,index)=><button type="button" key={name}
    aria-current={index===stage?'step':undefined} className={'furniture-step'+(stage===index?' current':'')}
    disabled={index>stage||index===2&&errors.length>0}
    onClick={()=>setStage(index as Stage)}>
    <span>{index+1}</span>{name}
   </button>)}
  </nav>
  <div className="cabinet-workspace">
   <div className="cabinet-form">
    {stage===0&&<>
     <div className="cabinet-step">01 / Select your starting template</div>
     <p className="muted">Choose a proven geometry. Every available template generates a complete 3D model and cut list. More template types will be added here.</p>
     <div className="furniture-template-list" role="group" aria-label="Furniture templates">
      {furnitureTemplates.map(template=>{
       const selected=spec.templateId===template.id
       return <button type="button" key={template.id}
        className={'furniture-template-card'+(selected?' selected':'')}
        disabled={template.status!=='ready'}
        aria-pressed={template.status==='ready'?selected:undefined}
        onClick={()=>selectTemplate(template)}>
        <span className="template-drawing" aria-hidden="true">
         <span className="template-outline">{Array.from({length:Math.min(5,template.defaultSpec?.shelves??2)},(_,i)=><span className="template-shelf" key={i}/>)}</span>
        </span>
        <span className="template-copy"><strong>{template.title}</strong>
         <small>{template.description}</small>
         <span className="template-category">{template.category} · {template.status==='ready'?'Available':'Planned'}</span>
        </span>
       </button>
      })}
     </div>
    </>}
    {stage===1&&<>
     <div className="cabinet-step">02 / Customize {furnitureTemplates.find(t=>t.id===spec.templateId)?.title??'cabinet'}</div>
     <label className="field"><span>{mode==='preset'?'Preset name':'Furniture item name'}</span>
      <input value={spec.label} maxLength={200} onChange={e=>change('label',e.target.value)}/></label>
     <div className="form-grid">
      {field('width','Overall width (mm)',1)}
      {field('height','Overall height (mm)',1)}
      {field('depth','Overall depth (mm)',1)}
     </div>
     <label className="field"><span>Material and board thickness</span>
      <select value={spec.materialId} onChange={e=>change('materialId',e.target.value)}>
       {materials.map(m=><option value={m.id} key={m.id}>{m.name} · {m.type} · {m.thickness} mm</option>)}
      </select></label>
     <div className="cabinet-shelf-picker">
      <div><strong>Internal shelves</strong><p className="muted">Automatically evenly spaced</p></div>
      <div className="cabinet-quantity">
       <button type="button" aria-label="Decrease shelves" disabled={spec.shelves===0}
        onClick={()=>change('shelves',Math.max(0,spec.shelves-1))}>−</button>
       <output aria-label="Shelf count">{spec.shelves}</output>
       <button type="button" aria-label="Increase shelves" disabled={spec.shelves===20}
        onClick={()=>change('shelves',Math.min(20,spec.shelves+1))}>+</button>
      </div>
     </div>
     <details className="cabinet-options"><summary>Advanced clearances, grain and ABS</summary>
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
    </>}
    {stage===2&&<>
     <div className="cabinet-step">03 / Review & save</div>
     <h3>{spec.label}</h3>
     <p className="muted">{furnitureTemplates.find(t=>t.id===spec.templateId)?.title??'Open cabinet'}</p>
     <dl className="furniture-review">
      <div><dt>Overall size</dt><dd>{spec.width} × {spec.height} × {spec.depth} mm</dd></div>
      <div><dt>Material</dt><dd>{material?.name} · {material?.thickness} mm</dd></div>
      <div><dt>Internal shelves</dt><dd>{spec.shelves}</dd></div>
      <div><dt>Total physical panels</dt><dd>{boxes.length}</dd></div>
      {mode==='preset'&&<div><dt>Preset category</dt><dd>{categories?.find(c=>c.id===category)?.name??'Uncategorized'}</dd></div>}
     </dl>
     <p className="muted">Review dimensions and cut quantities. Saving generates a new project furniture assembly or a reusable library preset.</p>
    </>}
   </div>
   <div className="cabinet-visual">
    <div className="cabinet-visual-head"><strong>Live complete-furniture preview</strong><small>Drag to orbit · scroll to zoom</small></div>
    {errors.length?<div className="cabinet-invalid" role="alert">{errors.map((err,i)=><p key={i}>{err}</p>)}</div>:
     <Suspense fallback={<div className="cabinet-no-webgl">Loading 3D preview…</div>}><CabinetPreview spec={spec} boxes={boxes}/></Suspense>}
    <div className="cabinet-stats">
     <div><small>Physical panels</small><strong>{boxes.length}</strong></div>
     <div><small>Internal width</small><strong>{inner} mm</strong></div>
     <div><small>Clear opening</small><strong>{Number.isFinite(clear)?Number(clear.toFixed(3)):0} mm</strong></div>
    </div>
    <div className="cabinet-step">Manufacturing cut list {stage===0?'· live estimate':''}</div>
    <div className="cabinet-cutlist-scroll"><table className="cabinet-cutlist">
     <thead><tr><th>Part</th><th>Cut size (mm)</th><th>Qty</th></tr></thead>
     <tbody>{rows.map(row=><tr key={row.label}><td>{row.label}</td><td>{row.width} × {row.height} × {material?.thickness}</td><td>{row.quantity}</td></tr>)}</tbody>
    </table></div>
   </div>
  </div>
  {error&&<p role="alert" className="preset-error">{error}</p>}
  <div className="cabinet-wizard-footer">
   {stage>0&&<button type="button" onClick={()=>{setStage(stage===2?1:0);setError('')}}>Back</button>}
   <button type="button" onClick={onCancel}>Cancel</button>
   {stage===2&&<button type="button" onClick={exportFusion} disabled={errors.length>0}>Export to Fusion 360 (.py)</button>}
   {stage<2?<button type="button" className="primary" onClick={next} disabled={stage===1&&errors.length>0}>
    {stage===0?'Customize selected template':'Review item'}
   </button>:<button type="button" className="primary" onClick={()=>void submit()} disabled={errors.length>0||saving}>
    {saving?'Saving…':mode==='item'?(editing?'Update item':'Add item to project'):'Save preset'}
   </button>}
  </div>
  <p className="muted cabinet-export-note">The preview and cut list use the same geometry. Fusion export is a component snapshot, not a live-linked .f3d.</p>
 </section>
}
