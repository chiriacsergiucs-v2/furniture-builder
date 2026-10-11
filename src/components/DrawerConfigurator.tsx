import {lazy,Suspense,useState} from 'react'
import type {Material} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {PresetCategory} from '../db/database.ts'
import {download,fileSlug} from '../import-export/files.ts'
import {exportFusionPython} from '../assembly/fusion.ts'
import {createDrawerForProject,drawerDefaults,drawerErrors,drawerParts,drawerSideSpace,drawerHardware,runnerProfiles} from '../furniture/drawer.ts'
import type {DrawerSpec} from '../furniture/drawer.ts'
const PositionedFurniturePreview=lazy(()=>import('./PositionedFurniturePreview.tsx'))

export function DrawerConfigurator({mode,materials,categories,initial,initialCategory,editing=false,onAdd,onSavePreset,onCancel}:{
 mode:'item'|'preset';materials:Material[];categories?:PresetCategory[]
 initial?:DrawerSpec;initialCategory?:string;editing?:boolean
 onAdd?:(spec:DrawerSpec)=>void|Promise<void>
 onSavePreset?:(spec:DrawerSpec,categoryId:string)=>void|Promise<void>
 onCancel:()=>void
}){
 const [spec,setSpec]=useState<DrawerSpec>(()=>{
  const id=materials[0]?.id??''
  const candidate=initial??drawerDefaults(id)
  return {...candidate,materialId:materials.some(m=>m.id===candidate.materialId)?candidate.materialId:id}
 })
 const [category,setCategory]=useState(initialCategory??'uncategorized')
 const [error,setError]=useState('')
 const [saving,setSaving]=useState(false)
 const material=materials.find(m=>m.id===spec.materialId)
 const issues=drawerErrors(spec,material)
 const boxes=issues.length||!material?[]:drawerParts(spec,material)
 const preview=issues.length||!material?null:(()=>{
  const fresh=createProject()
  const base={...fresh,materials:[material],parts:[],assemblies:[]}
  const built=createDrawerForProject(base,spec)
  return {project:{...base,parts:built.parts,assemblies:built.assemblies},assembly:built.assemblies[0]}
 })()
 const change=<K extends keyof DrawerSpec>(key:K,value:DrawerSpec[K])=>{setSpec(old=>({...old,[key]:value}));setError('')}
 const number=(key:'openingWidth'|'openingHeight'|'openingDepth'|'runnerLength'|'customSideClearance'|'upperClearance'|'rearClearance'|'frontGap'|'pullGap',label:string)=>
  <label className="field"><span>{label}</span><input type="number" step="1" min="0" value={spec[key]} onChange={e=>change(key,Number(e.target.value))}/></label>
 const save=async()=>{
  if(issues.length)return
  setSaving(true);setError('')
  try{
   if(mode==='item'){
    if(!onAdd)throw Error('Missing item destination')
    await onAdd(spec)
   }else{
    if(!onSavePreset)throw Error('Missing preset destination')
    await onSavePreset(spec,category)
   }
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 const exportFusion=()=>{
  if(!preview)return
  try{download(fileSlug(spec.label)+'-fusion.py',exportFusionPython(preview.project,preview.assembly),'text/x-python;charset=utf-8')}
  catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 return <section className="card cabinet-wizard" role="region" aria-label={mode==='item'?'Configure drawer item':'Configure drawer preset'}>
  <div className="section-head"><div><h2>{editing?'Edit drawer':'Build reusable drawer component'}</h2>
   <p className="muted">Opening-driven dimensions · runner clearance · front options · live assembled 3D</p></div>
   <button type="button" onClick={onCancel}>Close editor</button></div>
  <div className="cabinet-workspace">
   <div className="cabinet-form">
    <div className="cabinet-step">Building component · C15 drawer box + C17 front</div>
    <label className="field"><span>{mode==='item'?'Drawer item name':'Reusable preset name'}</span>
     <input maxLength={200} value={spec.label} onChange={e=>change('label',e.target.value)}/></label>
    <div className="form-grid">{number('openingWidth','Opening width (mm)')}{number('openingHeight','Opening height (mm)')}{number('openingDepth','Opening depth (mm)')}</div>
    <label className="field"><span>Panel material</span><select value={spec.materialId} onChange={e=>change('materialId',e.target.value)}>
     {materials.map(m=><option key={m.id} value={m.id}>{m.name} · {m.thickness} mm</option>)}
    </select></label>
    <label className="field"><span>Runner / mounting system</span>
     <select value={spec.runner} onChange={e=>{
      const next=e.target.value as DrawerSpec['runner']
      setSpec(p=>({...p,runner:next,extension:next==='none'?'partial':next==='custom'?p.extension:'full'}));setError('')
     }}>{runnerProfiles.map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label>
    <p className="muted">{runnerProfiles.find(r=>r.id===spec.runner)?.note}</p>
    <label className="field"><span>Extension / travel</span><select value={spec.extension}
     disabled={spec.runner==='accuride-3832'||spec.runner==='blum-movento'||spec.runner==='none'}
     onChange={e=>change('extension',e.target.value as DrawerSpec['extension'])}>
     <option value="full">Full extension</option><option value="partial">Partial extension</option>
    </select></label>
    <div className="form-grid">
     {spec.runner!=='none'&&number('runnerLength','Nominal runner length (mm)')}
     {spec.runner==='custom'&&number('customSideClearance','Custom side clearance / side (mm)')}
     {number('upperClearance','Upper clearance (mm)')}{number('rearClearance','Rear clearance (mm)')}
    </div>
    <p className="muted">Side installation space: <strong>{drawerSideSpace(spec)} mm per side</strong>.
     {spec.runner==='custom'?' Confirm this value with your runner manufacturer.':' Hardware is listed as an installation choice, not yet as a 3D metal solid.'}</p>
    <label className="field"><span>Drawer front / pulling method</span>
     <select value={spec.front} onChange={e=>change('front',e.target.value as DrawerSpec['front'])}>
      <option value="applied">Additional applied front · handle can be fitted</option>
      <option value="lowered">Lowered inner front · finger-pull opening</option>
      <option value="none">Inner drawer front only · no applied front</option>
     </select></label>
    <div className="form-grid">
     {spec.front==='applied'&&number('frontGap','Applied front perimeter gap (mm)')}
     {spec.front==='lowered'&&number('pullGap','Finger-pull height (mm)')}
    </div>
    {mode==='preset'&&<label className="field"><span>Preset category</span>
     <select value={category} onChange={e=>setCategory(e.target.value)}>
      {(categories??[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
     </select></label>}
    <p className="muted">Hardware installation, fastening and front-handle drilling are not supplied as a certified manufacturing pattern. Confirm exact profile documentation before cutting/drilling.</p>
   </div>
   <div className="cabinet-visual">
    <div className="cabinet-visual-head"><strong>Complete drawer · live 3D</strong><small>Orbit · zoom · no loose-panel viewer</small></div>
    {issues.length?<div className="cabinet-invalid" role="alert">{issues.map(e=><p key={e}>{e}</p>)}</div>:
     preview&&<Suspense fallback={<p>Loading assembled drawer…</p>}><PositionedFurniturePreview project={preview.project} assembly={preview.assembly}/></Suspense>}
    <div className="cabinet-step">Derived manufacturing cut list</div>
    <div className="cabinet-cutlist-scroll"><table className="cabinet-cutlist">
     <thead><tr><th>Component part</th><th>Dimensions (mm)</th><th>Qty</th></tr></thead>
     <tbody>{boxes.map(p=><tr key={p.label}><td>{p.label}</td><td>{p.width} × {p.height} × {material?.thickness}</td><td>{p.quantity}</td></tr>)}</tbody>
    </table></div>
    <div className="cabinet-step">Fittings / hardware (separate from board cut list)</div>
    {drawerHardware(spec).length?<div className="stack">
     {drawerHardware(spec).map(h=><p className="muted" key={h.label}>{h.quantity} {h.unit} · {h.label}</p>)}
    </div>:<p className="muted">No metal runner selected. Drawer movement/support not yet engineered.</p>}
   </div>
  </div>
  {error&&<p role="alert" className="preset-error">{error}</p>}
  <div className="cabinet-wizard-footer"><button onClick={onCancel}>Cancel</button>
   <button onClick={exportFusion} disabled={issues.length>0}>Export to Fusion 360 (.py)</button>
   <button className="primary" disabled={issues.length>0||saving} onClick={()=>void save()}>
    {saving?'Saving…':mode==='item'?(editing?'Update drawer':'Add drawer to project'):'Save drawer preset'}</button>
  </div>
 </section>
}
