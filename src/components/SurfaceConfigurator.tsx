import {lazy,Suspense,useState} from 'react'
import type {Material} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {PresetCategory} from '../db/database.ts'
import {download,fileSlug} from '../import-export/files.ts'
import {exportFusionPython} from '../assembly/fusion.ts'
import {surfacePanels,surfaceErrors,surfaceForProject} from '../furniture/surface.ts'
import type {SurfaceSpec} from '../furniture/surface.ts'
import {furnitureTemplates,initialSurfaceSpecForTemplate} from '../furniture/templates.ts'
const PositionedFurniturePreview=lazy(()=>import('./PositionedFurniturePreview.tsx'))

export function SurfaceConfigurator({mode,materials,categories,initial,initialCategory,onAdd,onSavePreset,onCancel}:{
 mode:'item'|'preset';materials:Material[];categories?:PresetCategory[];
 initial?:SurfaceSpec;initialCategory?:string
 onAdd?:(spec:SurfaceSpec)=>Promise<void>|void
 onSavePreset?:(spec:SurfaceSpec,categoryId:string)=>Promise<void>|void
 onCancel:()=>void
}){
 const [spec,setSpec]=useState<SurfaceSpec>(()=>initial??initialSurfaceSpecForTemplate('desk-gable',materials[0]?.id??''))
 const [category,setCategory]=useState(initialCategory??'uncategorized')
 const [error,setError]=useState('')
 const [saving,setSaving]=useState(false)
 const [show3d,setShow3d]=useState(false)
 const material=materials.find(m=>m.id===spec.materialId)
 const problems=surfaceErrors(spec,material)
 const boxes=!problems.length&&material?surfacePanels(spec,material):[]
 const preview=(()=>{
  if(!material||problems.length)return null
  const base=createProject()
  const empty={...base,materials:[material],parts:[],assemblies:[]}
  const built=surfaceForProject(empty,spec)
  return {...empty,parts:built.parts,assemblies:built.assemblies}
 })()
 const selectTemplate=(id:string)=>{
  setSpec(initialSurfaceSpecForTemplate(id,spec.materialId));setError('');setShow3d(false)
 }
 const update=<K extends keyof SurfaceSpec>(key:K,value:SurfaceSpec[K])=>{
  setSpec(old=>({...old,[key]:value}));setError('')
 }
 const submit=async()=>{
  if(problems.length)return
  setSaving(true);setError('')
  try{if(mode==='item'){if(!onAdd)throw Error('Destination missing');await onAdd(spec)}
   else {if(!onSavePreset)throw Error('Preset save action missing');await onSavePreset(spec,category)}
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setSaving(false)}
 }
 const fusion=()=>{
  if(!preview?.assemblies?.[0])return
  try{download(fileSlug(spec.label)+'-fusion.py',exportFusionPython(preview,preview.assemblies[0]),'text/x-python;charset=utf-8')}
  catch(e){setError(String(e))}
 }
 return <section role="region" aria-label="Worktop furniture configurator" className="card stack">
  <div className="section-head"><div><h2>{mode==='preset'?'Create worktop preset':'Add desk or table'}</h2>
   <p className="muted">Independent worktop/support components · exact mm dimensions · panel-based manufacturing</p>
   </div><button onClick={onCancel}>Close editor</button></div>
  <label className="field"><span>Design</span>
   <select aria-label="Worktop template" value={spec.templateId} onChange={e=>selectTemplate(e.target.value)}>
    {furnitureTemplates.filter(t=>t.status==='ready'&&t.kind==='surface').map(t=>
     <option key={t.id} value={t.id}>{t.category} · {t.title}</option>)}
   </select></label>
  <div className="form-grid">
   <label className="field"><span>Name</span><input value={spec.label} onChange={e=>update('label',e.target.value)}/></label>
   <label className="field"><span>Width mm</span><input type="number" min="400" step="1" value={spec.width} onChange={e=>update('width',Number(e.target.value))}/></label>
   <label className="field"><span>Height mm</span><input type="number" min="300" step="1" value={spec.height} onChange={e=>update('height',Number(e.target.value))}/></label>
   <label className="field"><span>Depth mm</span><input type="number" min="250" step="1" value={spec.depth} onChange={e=>update('depth',Number(e.target.value))}/></label>
   <label className="field"><span>Material / thickness</span><select value={spec.materialId} onChange={e=>update('materialId',e.target.value)}>
    {materials.map(m=><option key={m.id} value={m.id}>{m.name} · {m.thickness} mm</option>)}
   </select></label>
  </div>
  <details className="part-advanced"><summary>Advanced · supports and setbacks</summary>
   <div className="form-grid">
    <label className="field"><span>Support layout</span><select value={spec.layout} onChange={e=>update('layout',e.target.value as SurfaceSpec['layout'])}>
     {(['gables','four-supports','trestle','single-pedestal','dual-pedestal','console'] as const).map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>
    <label className="field"><span>Support inset mm</span><input type="number" min="20" step="1" value={spec.inset} onChange={e=>update('inset',Number(e.target.value))}/></label>
    <label className="field"><span>Leg panel depth mm</span><input type="number" min="40" step="1" value={spec.supportDepth} onChange={e=>update('supportDepth',Number(e.target.value))}/></label>
   </div>
  </details>
  {mode==='preset'&&<label className="field"><span>Preset category</span><select value={category} onChange={e=>setCategory(e.target.value)}>
   {(categories??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
  </select></label>}
  {problems.length>0&&<p role="alert" className="preset-error">{problems.join('; ')}</p>}
  {error&&<p role="alert" className="preset-error">{error}</p>}
  <div className="actions"><button type="button" disabled={problems.length>0} onClick={()=>setShow3d(v=>!v)}>{show3d?'Hide':'View'} complete 3D</button>
   <button type="button" disabled={problems.length>0} onClick={fusion}>Export Fusion solids</button>
  </div>
  {show3d&&preview?.assemblies?.[0]&&<Suspense fallback={<p>Loading complete furniture model…</p>}>
   <PositionedFurniturePreview project={preview} assembly={preview.assemblies[0]}/>
  </Suspense>}
  <p className="muted">{boxes.length} separately positioned physical panels; {boxes.reduce((a,b)=>a+b.cutWidth*b.cutHeight,0)/1e6} m² cut area · {surfacePartsPreview(boxes)}. Engineering validation of load, fixings, and anti-racking is not provided.</p>
  <div className="actions">
   <button type="button" className="primary" disabled={saving||problems.length>0} onClick={()=>void submit()}>
    {saving?'Saving…':mode==='preset'?'Save worktop preset':'Add furniture to project'}
   </button>
   <button type="button" onClick={onCancel}>Cancel</button>
  </div>
 </section>
}
function surfacePartsPreview(boxes:ReturnType<typeof surfacePanels>):string{
 return [...new Set(boxes.map(p=>p.label))].join(', ')
}
