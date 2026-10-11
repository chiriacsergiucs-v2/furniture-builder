import {lazy,Suspense,useState} from 'react'
import type {Material,GrainAxis} from '../engine/types.ts'
import {createProject} from '../engine/types.ts'
import type {PresetCategory} from '../db/database.ts'
import {download,fileSlug} from '../import-export/files.ts'
import {exportFusionPython} from '../assembly/fusion.ts'
import {cabinetErrors,cabinetBoxes,createCabinetForProject} from '../furniture/cabinet.ts'
import type {CabinetSpec,CompartmentLayout} from '../furniture/cabinet.ts'
import {furnitureTemplates,initialSpecForTemplate} from '../furniture/templates.ts'
import {drawerDefaults,runnerProfiles,drawerSideSpace,drawerHardware} from '../furniture/drawer.ts'
import type {DrawerSpec} from '../furniture/drawer.ts'
import type {FurnitureTemplate} from '../furniture/templates.ts'

const CabinetPreview=lazy(()=>import('./CabinetPreview.tsx'))
type Stage=0|1|2
const steps=['Choose template','Customize','Review & save'] as const

export function CabinetConfigurator({mode,materials,categories,initial,initialCategory,editing=false,onAdd,onSavePreset,onChooseDrawer,onCancel}:{
 mode:'item'|'preset';materials:Material[];categories?:PresetCategory[];editing?:boolean
 initial?:CabinetSpec;initialCategory?:string
 onAdd?:(spec:CabinetSpec)=>Promise<void>|void
 onSavePreset?:(spec:CabinetSpec,categoryId:string)=>Promise<void>|void
 onChooseDrawer?:()=>void
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
 const rows=[...boxes.reduce((groups,b)=>{
  const label=b.label??b.role,key=JSON.stringify([label,b.cutWidth,b.cutHeight])
  const item=groups.get(key)
  groups.set(key,{label,width:b.cutWidth,height:b.cutHeight,quantity:(item?.quantity??0)+1})
  return groups
 },new Map<string,{label:string;width:number;height:number;quantity:number}>()).values()]
 const hasDrawers=(spec.drawers??0)>0||Boolean(spec.split&&
  [spec.split.first,spec.split.second].some(b=>b.content==='drawers'&&b.count>0))||
  Boolean(spec.connected&&spec.connected.drawers>0)
 const change=<K extends keyof CabinetSpec>(key:K,value:CabinetSpec[K])=>{setSpec(old=>({...old,[key]:value}));setError('')}
 const changeShelfCount=(count:number)=>{setSpec(old=>({...old,shelves:count,
  shelfPositions:Array.from({length:count},(_,i)=>(old.shelfPositions?.[i]??Math.round((i+1)*100/(count+1))))
 }));setError('')}
 const setSplitAxis=(axis:'single'|'vertical'|'horizontal')=>{
  setSpec(old=>{
   if(axis==='single')return {...old,split:undefined}
   return {...old,shelves:0,drawers:0,split:{
    axis,ratio:old.split?.ratio??50,
    first:old.split?.first??{content:old.drawers?'drawers':'shelves',count:old.drawers||old.shelves||2},
    second:old.split?.second??{content:'shelves',count:2}
   },drawerConfig:old.drawerConfig??{...drawerDefaults(old.materialId),runnerLength:300}}
  });setError('')
 }
 const changeBay=(index:0|1,patch:Partial<CompartmentLayout>)=>{
  setSpec(old=>{
   if(!old.split)return old
   const key=index===0?'first':'second'
   const updated={...old.split[key],...patch}
   if(patch.content==='empty')updated.count=0
   if(patch.content&&patch.content!=='empty'&&updated.count===0)updated.count=1
   return {...old,split:{...old.split,[key]:updated}}
  });setError('')
 }
 const changeConnected=(enabled:boolean)=>setSpec(old=>({...old,
  connected:enabled?old.connected??{width:600,shelves:2,drawers:0}:undefined
 }))
 const changeDrawers=(count:number)=>{setSpec(old=>({
  ...old,drawers:count,shelves:count>0?0:old.shelves,
  drawerConfig:old.drawerConfig??{...drawerDefaults(old.materialId),runnerLength:300}
 }));setError('')}
 const changeDrawerConfig=<K extends keyof DrawerSpec>(key:K,value:DrawerSpec[K])=>{
  setSpec(old=>({...old,drawerConfig:{...(old.drawerConfig??{...drawerDefaults(old.materialId),runnerLength:300}),[key]:value}}))
  setError('')
 }
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
     <div className="cabinet-step">Building components · reusable</div>
     <div className="furniture-template-list" role="group" aria-label="Building component library">
      <button type="button" className="furniture-template-card" onClick={onChooseDrawer} disabled={!onChooseDrawer}>
       <span className="template-copy"><strong>C15 · Configurable drawer box</strong><small>Runners, clearances, optional applied front or lowered finger-pull front</small><span className="template-category">Ready · Reusable in furniture</span></span>
      </button>
      <div className="furniture-template-card"><span className="template-copy"><strong>C02 · Shelves</strong><small>Adjustable quantity, spacing and clearance inside the cabinet</small><span className="template-category">Integrated into carcass</span></span></div>
      <div className="furniture-template-card"><span className="template-copy"><strong>Doors, vertical partitions, support legs</strong><small>Planned reusable component types</small><span className="template-category">Not implemented yet</span></span></div>
     </div>
     <div className="cabinet-step">Furniture templates</div>
     <div className="furniture-template-list" role="group" aria-label="Furniture templates">
      {furnitureTemplates.map(template=>{
       const selected=spec.templateId===template.id
       return <button type="button" key={template.id}
        className={'furniture-template-card'+(selected?' selected':'')}
        disabled={template.status!=='ready'||template.kind==='drawer'&&!onChooseDrawer}
        aria-pressed={template.status==='ready'?selected:undefined}
        onClick={()=>template.kind==='drawer'?onChooseDrawer?.():selectTemplate(template)}>
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
     <div className="cabinet-step">Interior composition · modular components</div>
     <label className="field"><span>Compartment layout</span>
      <select aria-label="Compartment layout" value={spec.split?.axis??'single'}
       onChange={e=>setSplitAxis(e.target.value as 'single'|'vertical'|'horizontal')}>
       <option value="single">One open compartment</option>
       <option value="vertical">Split left / right · vertical divider</option>
       <option value="horizontal">Split lower / upper · horizontal divider</option>
      </select></label>
     {spec.split&&<>
      <label className="field"><span>First compartment share (%)</span>
       <input type="number" min="10" max="90" step="1" value={spec.split.ratio}
        onChange={e=>change('split',{...spec.split!,ratio:Number(e.target.value)})}/></label>
      {[spec.split.first,spec.split.second].map((bay,index)=><div key={index} className="cabinet-shelf-picker">
       <div><strong>{spec.split!.axis==='vertical'?(index===0?'Left':'Right'):(index===0?'Lower':'Upper')} compartment</strong>
        <p className="muted">Independent reusable shelf or drawer children</p></div>
       <div className="form-grid">
        <label className="field"><span>Contents</span><select value={bay.content} onChange={e=>changeBay(index as 0|1,{content:e.target.value as CompartmentLayout['content']})}>
         <option value="empty">Empty</option><option value="shelves">Shelves</option><option value="drawers">Drawers</option>
        </select></label>
        {bay.content!=='empty'&&<label className="field"><span>Repeat count</span><input type="number" min="1" max="20" step="1"
         value={bay.count} onChange={e=>changeBay(index as 0|1,{count:Number(e.target.value)})}/></label>}
       </div>
      </div>)}
      <p className="muted">Changing a bay from shelves to drawers replaces its child components. The separating panel is included in the cut list.</p>
     </>}
     {!spec.split&&<>
     <div className="cabinet-step">Single-compartment children</div>
     <p className="muted">Repeat shelves or drawers here, or select a split layout to combine independently configurable compartments.</p>
     <div className="cabinet-shelf-picker">
      <div><strong>Configurable drawers</strong><p className="muted">Each drawer inherits the cabinet's clear internal opening</p></div>
      <div className="cabinet-quantity">
       <button type="button" aria-label="Remove drawer" disabled={(spec.drawers??0)===0} onClick={()=>changeDrawers(Math.max(0,(spec.drawers??0)-1))}>−</button>
       <output aria-label="Drawer count">{spec.drawers??0}</output>
       <button type="button" aria-label="Insert drawer" disabled={(spec.drawers??0)>=20} onClick={()=>changeDrawers(Math.min(20,(spec.drawers??0)+1))}>+</button>
      </div>
     </div>
     </>}
     {hasDrawers&&<div className="form-grid">
      <label className="field"><span>Runner profile</span><select value={spec.drawerConfig?.runner??'accuride-3832'}
       onChange={e=>{const runner=e.target.value as DrawerSpec['runner'];setSpec(old=>({...old,drawerConfig:{
        ...(old.drawerConfig??{...drawerDefaults(old.materialId),runnerLength:300}),
        runner,extension:runner==='none'?'partial':'full'}}))}}>
       {runnerProfiles.map(r=><option value={r.id} key={r.id}>{r.title}</option>)}</select></label>
      <label className="field"><span>Drawer front</span><select value={spec.drawerConfig?.front??'applied'} onChange={e=>changeDrawerConfig('front',e.target.value as DrawerSpec['front'])}>
       <option value="applied">Applied front · handle</option><option value="lowered">Lower front · finger pull</option><option value="none">Inner front only</option>
      </select></label>
      <label className="field"><span>Runner length (mm)</span><input type="number" step="1" min="1" value={spec.drawerConfig?.runnerLength??300} onChange={e=>changeDrawerConfig('runnerLength',Number(e.target.value))}/></label>
      {spec.drawerConfig?.runner==='custom'&&<label className="field"><span>Slide clearance per side (mm)</span><input type="number" step="1" min="1" value={spec.drawerConfig.customSideClearance} onChange={e=>changeDrawerConfig('customSideClearance',Number(e.target.value))}/></label>}
      <label className="field"><span>Upper clearance (mm)</span><input type="number" step="1" min="0" value={spec.drawerConfig?.upperClearance??6} onChange={e=>changeDrawerConfig('upperClearance',Number(e.target.value))}/></label>
      <label className="field"><span>Rear clearance (mm)</span><input type="number" step="1" min="0" value={spec.drawerConfig?.rearClearance??20} onChange={e=>changeDrawerConfig('rearClearance',Number(e.target.value))}/></label>
      {spec.drawerConfig?.front==='lowered'&&<label className="field"><span>Finger-pull gap (mm)</span><input type="number" step="1" min="15" value={spec.drawerConfig.pullGap} onChange={e=>changeDrawerConfig('pullGap',Number(e.target.value))}/></label>}
      {spec.drawerConfig?.front==='applied'&&<label className="field"><span>Applied front gap (mm)</span><input type="number" step="1" min="0" value={spec.drawerConfig.frontGap} onChange={e=>changeDrawerConfig('frontGap',Number(e.target.value))}/></label>}
      <p className="muted">Slide side space: {drawerSideSpace(spec.drawerConfig??{...drawerDefaults(spec.materialId),runnerLength:300})} mm/side. Verify runner-specific installation documentation.</p>
     </div>}
     {!spec.split&&(spec.drawers??0)===0&&<div className="cabinet-shelf-picker">
      <div><strong>Internal shelves</strong><p className="muted">Automatically evenly spaced</p></div>
      <div className="cabinet-quantity">
       <button type="button" aria-label="Decrease shelves" disabled={spec.shelves===0}
        onClick={()=>changeShelfCount(Math.max(0,spec.shelves-1))}>−</button>
       <output aria-label="Shelf count">{spec.shelves}</output>
       <button type="button" aria-label="Increase shelves" disabled={spec.shelves===20}
        onClick={()=>changeShelfCount(Math.min(20,spec.shelves+1))}>+</button>
      </div>
     </div>}
     {!spec.split&&(spec.drawers??0)===0&&spec.shelves>0&&<div className="stack">
      <label className="field"><span>Shelf positioning</span><select value={spec.shelfMode??'even'}
       onChange={e=>setSpec(old=>({...old,shelfMode:e.target.value as 'even'|'custom',
        shelfPositions:old.shelfPositions?.length===old.shelves?old.shelfPositions:
         Array.from({length:old.shelves},(_,i)=>Math.round((i+1)*100/(old.shelves+1)))
       }))}>
       <option value="even">Automatically spaced</option><option value="custom">Custom adjustable positions</option>
      </select></label>
      {spec.shelfMode==='custom'&&spec.shelfPositions?.map((percent,index)=><label className="field" key={index}>
       <span>Shelf {index+1} height (% from clear compartment bottom)</span>
       <input type="number" min="5" max="95" step="1" value={percent}
        onChange={e=>change('shelfPositions',spec.shelfPositions!.map((p,i)=>i===index?Number(e.target.value):p))}/></label>)}
     </div>}
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
     <div className="cabinet-step">Module connections</div>
     <label className="checkline"><input type="checkbox" checked={Boolean(spec.connected)}
      onChange={e=>changeConnected(e.target.checked)}/> Attach a second carcass to the right</label>
     {spec.connected&&<div className="form-grid">
      <label className="field"><span>Second module width (mm)</span><input type="number" min="100" step="1"
       value={spec.connected.width} onChange={e=>change('connected',{...spec.connected!,width:Number(e.target.value)})}/></label>
      <label className="field"><span>Second module interior</span><select value={spec.connected.drawers>0?'drawers':spec.connected.shelves>0?'shelves':'empty'}
       onChange={e=>setSpec(old=>({...old,connected:old.connected?{
         ...old.connected,shelves:e.target.value==='shelves'?2:0,drawers:e.target.value==='drawers'?2:0
        }:undefined,drawerConfig:e.target.value==='drawers'?
         old.drawerConfig??{...drawerDefaults(old.materialId),runnerLength:300}:old.drawerConfig}))}>
       <option value="empty">Empty</option><option value="shelves">Shelves</option><option value="drawers">Drawers</option>
      </select></label>
      {(spec.connected.shelves>0||spec.connected.drawers>0)&&<label className="field">
       <span>Second module component count</span><input type="number" min="1" max="20" step="1"
        value={spec.connected.drawers||spec.connected.shelves}
        onChange={e=>change('connected',{...spec.connected!,
         [spec.connected!.drawers>0?'drawers':'shelves']:Number(e.target.value)})}/></label>}
      <p className="muted">Docking uses the parent module's right anchor. Height, depth and material are shared; the second module has its own width and contents.</p>
     </div>}
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
      <div><dt>Internal shelves</dt><dd>{spec.shelves}</dd></div><div><dt>Inserted drawers</dt><dd>{spec.drawers??0}</dd></div>
      {spec.split&&<div><dt>Split bays</dt><dd>{spec.split.axis} · {spec.split.ratio}/{100-spec.split.ratio}% · {spec.split.first.content}/{spec.split.second.content}</dd></div>}
      {spec.connected&&<div><dt>Connected module</dt><dd>+{spec.connected.width} mm right · {spec.connected.drawers||spec.connected.shelves} components</dd></div>}
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
    {hasDrawers&&spec.drawerConfig&&<div>
     <div className="cabinet-step">Building hardware · not board cut pieces</div>
     {drawerHardware(spec.drawerConfig).length?drawerHardware(spec.drawerConfig).map(h=>
      <p className="muted" key={h.label}>{((spec.drawers??0)+(spec.split?[spec.split.first,spec.split.second].filter(b=>b.content==='drawers').reduce((n,b)=>n+b.count,0):0)+(spec.connected?.drawers??0))*h.quantity} {h.unit} · {h.label}</p>
     ):<p className="muted">Drawer movement mechanism not configured.</p>}
    </div>}
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
