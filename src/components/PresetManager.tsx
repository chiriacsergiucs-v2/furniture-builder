import {lazy,Suspense,useEffect,useState} from 'react'
import {CabinetConfigurator} from './CabinetConfigurator.tsx'
import {DrawerConfigurator} from './DrawerConfigurator.tsx'
import {createDrawerPreset} from '../furniture/drawer.ts'
import type {DrawerSpec} from '../furniture/drawer.ts'
import {createCabinetPreset,cabinetBoxes} from '../furniture/cabinet.ts'
import type {CabinetSpec} from '../furniture/cabinet.ts'
import {DRAWER_PRESET_ID} from '../assembly/model.ts'
import type {ChangeEvent} from 'react'
import type {Part,Project,Material,EdgeName,GrainAxis} from '../engine/types.ts'
import {download} from '../import-export/files.ts'
import {createPreset,instantiatePreset,newPresetItem,presetFromParts,presetMaterial,validatePreset} from '../presets/presets.ts'
import type {CutlistPreset,PresetItem,PresetMaterial} from '../presets/presets.ts'
import {duplicatePresetDraft} from '../presets/duplicate.ts'
import {PresetCustomization} from './PresetCustomization.tsx'
import {deletePreset,exportPresetLibrary,importPresetLibrary,listPresets,savePreset} from '../presets/storage.ts'
import {listCategories,saveCategory,deleteCategory} from '../db/repository.ts'
import type {PresetCategory,StoredPreset} from '../db/database.ts'
import {UNCATEGORIZED_ID} from '../db/database.ts'

const Preset3DViewer=lazy(()=>import('./Preset3DViewer.tsx'))
const CabinetPreview=lazy(()=>import('./CabinetPreview.tsx'))
const DrawerPresetPreview=lazy(()=>import('./DrawerPresetPreview.tsx'))
const edges:EdgeName[]=['top','right','bottom','left']
const starterMaterials:Material[]=[
 {id:'preset-pal18',name:'PAL 18 mm',type:'PAL',thickness:18},
 {id:'preset-mdf18',name:'MDF 18 mm',type:'MDF',thickness:18}
]
const materialKey=(m:PresetMaterial)=>JSON.stringify({name:m.name,type:m.type,thickness:m.thickness,finish:m.finish??''})
const message=(e:unknown)=>e instanceof Error?e.message:String(e)
type DraftMode='create'|'edit'|'duplicate'

function ItemDetails({item,index}:{item:PresetItem;index:number}){
 return <details className="preset-item-details">
  <summary>{index+1}. {item.label} — {item.width} × {item.height} × {item.material.thickness} mm · {item.quantity} pcs</summary>
  <p className="muted">{item.material.name} · Grain {item.grain} · Rotation {item.rotationAllowed?'allowed':'restricted'} · ABS: {edges.filter(e=>item.abs[e]).map(e=>e+': '+item.abs[e]).join(', ')||'none'}</p>
 </details>
}
function SavedPreset({preset,categoryName,projects,targetId,onTarget,onInsert,onEdit,onDuplicate,onCustomize,onDelete}:{
 preset:StoredPreset;categoryName:string;projects:Project[];targetId:string;onTarget:(id:string)=>void;
 onInsert:(id:string,parts:Part[],presetId:string,copies:number,cabinetSpec?:CabinetSpec,drawerSpec?:DrawerSpec)=>Promise<void>;
 onEdit:(p:StoredPreset)=>void;onDuplicate:(p:StoredPreset)=>void;onCustomize:(p:StoredPreset)=>void;onDelete:(p:StoredPreset)=>Promise<void>
}){
 const [sets,setSets]=useState(1)
 const [expanded3d,setExpanded3d]=useState(false)
 const showCompletePreview=Boolean(preset.cabinetSpec||preset.drawerSpec)||preset.id===DRAWER_PRESET_ID
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const add=async()=>{
  if(!targetId){setError('Select a destination project before inserting this preset.');return}
  try{
   const project=projects.find(p=>p.id===targetId)
   if(!project)throw Error('Destination project missing')
   const parts=instantiatePreset(preset,project,sets)
   setBusy(true);setError('')
   await onInsert(project.id,parts,preset.id,sets,preset.cabinetSpec,preset.drawerSpec)
   setNotice('Inserted '+parts.reduce((total,p)=>total+p.quantity,0)+' pieces into '+project.name+'.')
  }catch(e){setError(message(e))}finally{setBusy(false)}
 }
 return <article className="preset-card" data-preset-id={preset.id}>
  <details className="preset-entry">
   <summary><strong>{preset.label}</strong> <small>· {preset.items.length} cut rows / {preset.items.reduce((sum,i)=>sum+i.quantity,0)} pieces · {categoryName}</small></summary>
   <div className="preset-entry-body">
    <div className="preset-item-tree">{preset.items.map((item,i)=><ItemDetails key={i} item={item} index={i}/>)}</div>
    <div className="actions">
     {showCompletePreview&&<button type="button" onClick={()=>setExpanded3d(v=>!v)} aria-expanded={expanded3d}>{expanded3d?'Hide assembled 3D':'View assembled 3D'}</button>}
     <button type="button" onClick={()=>onEdit(preset)}>Edit original</button>
     <button type="button" onClick={()=>onDuplicate(preset)}>Duplicate with new params</button>
     <button type="button" className="danger" onClick={()=>void onDelete(preset)}>Delete</button>
    </div>
    {expanded3d&&showCompletePreview&&<div role="region" aria-label="Complete furniture 3D preview"><Suspense fallback={<p role="status">Loading assembled furniture…</p>}>
     {preset.cabinetSpec?<CabinetPreview spec={preset.cabinetSpec} boxes={cabinetBoxes(preset.cabinetSpec,preset.items[0].material.thickness)}/>:preset.drawerSpec?<DrawerPresetPreview preset={preset}/>:<Preset3DViewer preset={preset}/>}
    </Suspense></div>}
    {!showCompletePreview&&<p className="muted">No assembled 3D model saved for this preset. Cut dimensions alone do not define panel positions.</p>}
    <div className="preset-controls">
     <label className="field"><span>Sets to add</span><input type="number" step="1" min="1" max="20" value={sets} onChange={e=>setSets(Number(e.target.value))}/></label>
     <label className="field"><span>Destination project</span><select value={targetId} onChange={e=>onTarget(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
     <button className="primary" disabled={!targetId||busy||!Number.isSafeInteger(sets)||sets<1||sets>20} onClick={()=>void add()}>{busy?'Adding…':'Add to project'}</button>
     <button type="button" disabled={!targetId||busy} onClick={()=>onCustomize(preset)}>Customize for project</button>
    </div>
    {error&&<p role="alert" className="preset-error">{error}</p>}
    {notice&&<p role="status" className="preset-success">{notice}</p>}
   </div>
  </details>
 </article>
}
function CategoryBranch({category,all,visible,presets,projects,targetId,onTarget,onInsert,onEdit,onDuplicate,onCustomize,onDelete,depth=0}:{
 category:PresetCategory;all:PresetCategory[];visible:Set<string>;presets:StoredPreset[];
 projects:Project[];targetId:string;onTarget:(id:string)=>void;
 onInsert:(id:string,parts:Part[],presetId:string,copies:number,cabinetSpec?:CabinetSpec,drawerSpec?:DrawerSpec)=>Promise<void>;
 onEdit:(p:StoredPreset)=>void;onDuplicate:(p:StoredPreset)=>void;onCustomize:(p:StoredPreset)=>void;onDelete:(p:StoredPreset)=>Promise<void>;depth?:number
}){
 const children=all.filter(c=>c.parentId===category.id&&visible.has(c.id))
 const rows=presets.filter(p=>(p.categoryId??UNCATEGORIZED_ID)===category.id)
 if(!visible.has(category.id))return null
 return <details className="preset-category-branch" >
  <summary>{category.name} <small>({rows.length} presets{children.length?', '+children.length+' subcategories':''})</small></summary>
  <div className="preset-category-content">
   {rows.map(p=><SavedPreset key={p.id} preset={p} categoryName={category.name} projects={projects}
    targetId={targetId} onTarget={onTarget} onInsert={onInsert} onEdit={onEdit}
    onDuplicate={onDuplicate} onCustomize={onCustomize} onDelete={onDelete}/>)}
   {children.map(child=><CategoryBranch key={child.id} category={child} all={all} visible={visible} presets={presets}
    projects={projects} targetId={targetId} onTarget={onTarget} onInsert={onInsert} onEdit={onEdit}
    onDuplicate={onDuplicate} onCustomize={onCustomize} onDelete={onDelete} depth={depth+1}/>)}
  </div>
 </details>
}

export function PresetManager({project,projects,onInsert}:{
 project:Project|null;projects:Project[];
 onInsert:(projectId:string,parts:Part[],presetId:string,copies:number,cabinetSpec?:CabinetSpec,drawerSpec?:DrawerSpec)=>Promise<void>
}){
 const [library,setLibrary]=useState<StoredPreset[]>([])
 const [categories,setCategories]=useState<PresetCategory[]>([])
 const [targetId,setTargetId]=useState(project?.id??'')
 const [newCategory,setNewCategory]=useState('')
 const [parentCategory,setParentCategory]=useState('')
 const [selectedCategory,setSelectedCategory]=useState(UNCATEGORIZED_ID)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [draft,setDraft]=useState<CutlistPreset|null>(null)
 const [draftMode,setDraftMode]=useState<DraftMode>('create')
 const [customizing,setCustomizing]=useState<StoredPreset|null>(null)
 const [cabinetEditor,setCabinetEditor]=useState<{source?:StoredPreset;duplicate?:boolean;initial?:CabinetSpec}|null>(null)
 const [drawerEditor,setDrawerEditor]=useState<{source?:StoredPreset;duplicate?:boolean;initial?:DrawerSpec}|null>(null)
 const [configuredId,setConfiguredId]=useState('')
 const [filter,setFilter]=useState('')
 const [busy,setBusy]=useState(false)
 const materials=project?.materials.length?project.materials:starterMaterials
 const configured=project?.assemblies?.filter(a=>a.cabinetSpec||a.drawerSpec)??[]
 const fromConfigured=()=>{
  const selected=configured.find(a=>a.id===(configuredId||configured[0]?.id))
  if(!selected){onError(new Error('Choose a configured item first.'));return}
  setDraft(null);setDrawerEditor(null);setCabinetEditor(null)
  setSelectedCategory(UNCATEGORIZED_ID);setError('')
  if(selected.cabinetSpec)setCabinetEditor({initial:structuredClone(selected.cabinetSpec)})
  else if(selected.drawerSpec)setDrawerEditor({initial:structuredClone(selected.drawerSpec)})
  setNotice('Unsaved configured item. Review parameters, then press Save preset to add it to the library.')
 }
 useEffect(()=>{let active=true;void Promise.all([listPresets(),listCategories()])
  .then(([saved,groups])=>{if(active){setLibrary(saved);setCategories(groups)}})
  .catch(e=>{if(active)setError(message(e))});return()=>{active=false}},[])
 useEffect(()=>{if(project?.id&&projects.some(p=>p.id===project.id))setTargetId(current=>current||project.id)},[project?.id,projects])
 const onError=(e:unknown)=>{setError(message(e));setNotice('')}
 const customize=(preset:StoredPreset)=>{
  if(!targetId||!projects.some(p=>p.id===targetId)){onError(new Error('Select a destination project first.'));return}
  setDraft(null);setCabinetEditor(null);setDrawerEditor(null)
  setCustomizing(preset);setError('');setNotice('')
 }
 const newDraft=()=>{
  setCabinetEditor(null)
  setDraft(createPreset('',[newPresetItem(materials[0])]))
  setDraftMode('create');setSelectedCategory(UNCATEGORIZED_ID);setError('');setNotice('')
 }
 const fromParts=()=>{try{
  if(!project?.parts.length)throw Error('Open a project containing parts first')
  setDraft(presetFromParts(project));setDraftMode('create');setSelectedCategory(UNCATEGORIZED_ID);setError('');setNotice('')
 }catch(e){onError(e)}}
 const beginEdit=(p:StoredPreset)=>{
  if(p.drawerSpec){setDraft(null);setCabinetEditor(null);setDrawerEditor({source:p});setSelectedCategory(p.categoryId);setError('');setNotice('');return}
  if(p.cabinetSpec){setDraft(null);setCabinetEditor({source:p});setSelectedCategory(p.categoryId);setError('');setNotice('');return}
  setCabinetEditor(null);setDraft(structuredClone(p));setSelectedCategory(p.categoryId);setDraftMode('edit');setError('');setNotice('')}
 const beginDuplicate=(p:StoredPreset)=>{
  if(p.drawerSpec){setDraft(null);setCabinetEditor(null);setDrawerEditor({source:p,duplicate:true});setSelectedCategory(p.categoryId);setError('');setNotice('Unsaved drawer copy.');return}
  if(p.cabinetSpec){setDraft(null);setCabinetEditor({source:p,duplicate:true});setSelectedCategory(p.categoryId);setError('');setNotice('Unsaved cabinet copy. The original remains unchanged.');return}
  setCabinetEditor(null)
  setDraft(duplicatePresetDraft(p));setSelectedCategory(p.categoryId);setDraftMode('duplicate');setError('')
  setNotice('Unsaved duplicate draft. No preset is created until you press Save duplicate.')
 }
 const saveCabinet=async(spec:CabinetSpec,categoryId:string)=>{
  try{
   setBusy(true)
   const material=materials.find(m=>m.id===spec.materialId)
   if(!material)throw Error('Choose an available material.')
   const created=createCabinetPreset(spec,material)
   const previous=cabinetEditor?.duplicate?undefined:cabinetEditor?.source
   const updated=await savePreset({...created,id:previous?.id??created.id,createdAt:previous?.createdAt??created.createdAt,categoryId})
   setLibrary(updated);setCabinetEditor(null);setError('');setNotice(previous?'Cabinet preset updated.':'Cabinet preset saved.')
  }catch(e){onError(e);throw e}finally{setBusy(false)}
 }
 const saveDrawer=async(spec:DrawerSpec,categoryId:string)=>{
  try{
   setBusy(true)
   const material=materials.find(m=>m.id===spec.materialId)
   if(!material)throw Error('Choose a valid drawer material.')
   const created=createDrawerPreset(spec,material)
   const previous=drawerEditor?.duplicate?undefined:drawerEditor?.source
   const updated=await savePreset({...created,id:previous?.id??created.id,createdAt:previous?.createdAt??created.createdAt,categoryId})
   setLibrary(updated);setDrawerEditor(null);setError('');setNotice(previous?'Drawer component updated.':'Drawer component saved as reusable preset.')
  }catch(e){onError(e);throw e}finally{setBusy(false)}
 }
 const editItem=(idx:number,patch:Partial<PresetItem>)=>setDraft(p=>p?{...p,items:p.items.map((item,i)=>i===idx?{...item,...patch}:item)}:p)
 const save=async()=>{if(!draft)return
  try{const problems=validatePreset(draft);if(problems.length)throw Error(problems.join('; '))
   setBusy(true)
   const updated=await savePreset({...draft,categoryId:selectedCategory})
   setLibrary(updated);setDraft(null);setError('')
   setNotice(draftMode==='duplicate'?'Duplicate saved as a new preset.':'Preset saved.')
  }catch(e){onError(e)}finally{setBusy(false)}
 }
 const deleteSaved=async(p:StoredPreset)=>{if(!window.confirm('Delete preset “'+p.label+'”? Existing project parts remain.'))return
  try{setLibrary(await deletePreset(p.id));if(draft?.id===p.id)setDraft(null);setNotice('Preset deleted.');setError('')}catch(e){onError(e)}
 }
 const createCategory=async()=>{try{
  if(!newCategory.trim())throw Error('Enter a category name')
  const timestamp=new Date().toISOString()
  await saveCategory({schemaVersion:1,id:crypto.randomUUID(),name:newCategory.trim(),parentId:parentCategory||null,
   sortOrder:categories.length,createdAt:timestamp,updatedAt:timestamp})
  setCategories(await listCategories());setNewCategory('');setParentCategory('');setNotice('Category saved');setError('')
 }catch(e){onError(e)}}
 const removeCategory=async()=>{if(selectedCategory===UNCATEGORIZED_ID)return
  if(!window.confirm('Delete this category? Presets will become Uncategorized.'))return
  try{await deleteCategory(selectedCategory);setCategories(await listCategories());setLibrary(await listPresets());setSelectedCategory(UNCATEGORIZED_ID);setError('')}catch(e){onError(e)}}
 const importBackup=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return
  try{setLibrary(await importPresetLibrary(await file.text()));setNotice('Preset library imported');setError('')}catch(e){onError(e)}}
 const matches=library.filter(p=>[p.label,...p.items.map(i=>i.label)].some(t=>t.toLowerCase().includes(filter.toLowerCase())))
 const matchesCategory=(id:string,seen=new Set<string>()):boolean=>{
  if(seen.has(id))return false;seen.add(id)
  return matches.some(p=>(p.categoryId??UNCATEGORIZED_ID)===id)||
   categories.filter(c=>c.parentId===id).some(c=>matchesCategory(c.id,seen))
 }
 const visible=new Set(categories.filter(c=>matchesCategory(c.id)).map(c=>c.id))
 const roots=categories.filter(c=>!c.parentId||!categories.some(parent=>parent.id===c.parentId))
 const orphaned=matches.filter(p=>!categories.some(c=>c.id===(p.categoryId??UNCATEGORIZED_ID)))
 return <section id="presets" className="card preset-library-page" aria-label="Presets">
  <div className="section-head"><h2>Preset library <small>({library.length} saved)</small></h2>
   <div className="actions compact-actions">
    <button type="button" className="primary" onClick={()=>{setDraft(null);setDrawerEditor(null);setCabinetEditor({});setSelectedCategory(UNCATEGORIZED_ID);setError('');setNotice('')}}>+ Create preset</button><button type="button" onClick={()=>{setDrawerEditor({});setCabinetEditor(null);setDraft(null);setError('');setNotice('')}}>+ Reusable drawer component</button><button type="button" onClick={newDraft}>Manual preset</button>
    <button type="button" disabled={!project?.parts.length} onClick={fromParts}>Save project parts as preset</button>
   </div>
  </div>
  <p className="muted">Expand a category, preset, then item. 3D views load on demand. Drafts only persist on explicit Save.</p>
  {configured.length>0&&<div className="preset-category-editor"><label className="field"><span>Project item to reuse</span>
   <select value={configuredId||configured[0]?.id||''} onChange={e=>setConfiguredId(e.target.value)}>
    {configured.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
   </select></label>
   <button type="button" onClick={fromConfigured}>Configure as new preset</button>
  </div>}
  <div className="preset-category-editor">
   <label className="field"><span>New category</span><input placeholder="Cabinets, Shelves…" value={newCategory} onChange={e=>setNewCategory(e.target.value)}/></label>
   <label className="field"><span>Parent category</span><select value={parentCategory} onChange={e=>setParentCategory(e.target.value)}>
    <option value="">Top level</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
   </select></label>
   <button onClick={()=>void createCategory()}>+ Save category</button>
  </div>
  {error&&<p className="preset-error" role="alert">{error}</p>}
  {notice&&<p className="preset-success" role="status">{notice}</p>}
  {customizing&&projects.some(p=>p.id===targetId)&&<PresetCustomization key={customizing.id}
   source={customizing} project={projects.find(p=>p.id===targetId)!} onInsert={onInsert}
   onCancel={()=>setCustomizing(null)}/>} 
  {cabinetEditor&&<CabinetConfigurator key={(cabinetEditor.source?.id??'new')+(cabinetEditor.duplicate?'-copy':'')} mode="preset" materials={materials} categories={categories} initialCategory={cabinetEditor.source?.categoryId??UNCATEGORIZED_ID}
   initial={cabinetEditor.initial??(cabinetEditor.source?.cabinetSpec?{...cabinetEditor.source.cabinetSpec,materialId:materials.find(m=>m.type===cabinetEditor.source?.items[0]?.material.type&&m.thickness===cabinetEditor.source?.items[0]?.material.thickness)?.id??materials[0]?.id??''}:undefined)}
   onSavePreset={saveCabinet} onChooseDrawer={()=>{setCabinetEditor(null);setDrawerEditor({})}} onCancel={()=>setCabinetEditor(null)}/>}
  {drawerEditor&&<DrawerConfigurator key={(drawerEditor.source?.id??'new')+(drawerEditor.duplicate?'-copy':'')} mode="preset" materials={materials} categories={categories} initialCategory={drawerEditor.source?.categoryId??UNCATEGORIZED_ID}
   initial={drawerEditor.initial??(drawerEditor.source?.drawerSpec?{...drawerEditor.source.drawerSpec,materialId:materials.find(m=>m.type===drawerEditor.source?.items[0]?.material.type&&m.thickness===drawerEditor.source?.items[0]?.material.thickness)?.id??materials[0]?.id??''}:undefined)}
   onSavePreset={saveDrawer} onCancel={()=>setDrawerEditor(null)}/>}
  {draft&&<div role="region" className="preset-editor" aria-label="Preset draft editor">
   <h3>{draftMode==='duplicate'?'Duplicate with new params (unsaved)':draftMode==='edit'?'Edit preset':'New preset'}</h3>
   <p className="muted">{draftMode==='duplicate'?'The original is unchanged. Change the name, dimensions, quantities, materials or ABS; nothing is created until Save duplicate.':'Changes are stored only when Save is pressed.'}</p>
   <div className="form-grid">
    <label className="field"><span>Preset label</span><input placeholder="Drawer top" value={draft.label} onChange={e=>setDraft(p=>p?{...p,label:e.target.value}:p)}/></label>
    <label className="field"><span>Category</span><select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>
     {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
    </select></label>
   </div>
   <button type="button" className="danger" disabled={selectedCategory===UNCATEGORIZED_ID} onClick={()=>void removeCategory()}>Delete selected category</button>
   <div className="preset-items">
    {draft.items.map((item,i)=><div className="part-card" key={i}>
     <div className="section-head"><strong>Cut item {i+1}</strong><button className="danger" disabled={draft.items.length===1} onClick={()=>setDraft(p=>p?{...p,items:p.items.filter((_,j)=>j!==i)}:p)}>Remove item</button></div>
     <div className="form-grid">
      <label className="field"><span>Item label</span><input value={item.label} onChange={e=>editItem(i,{label:e.target.value})}/></label>
      <label className="field"><span>Width mm</span><input type="number" min="1" step="1" value={item.width} onChange={e=>editItem(i,{width:Number(e.target.value)})}/></label>
      <label className="field"><span>Height mm</span><input type="number" min="1" step="1" value={item.height} onChange={e=>editItem(i,{height:Number(e.target.value)})}/></label>
      <label className="field"><span>Quantity per preset</span><input type="number" min="1" step="1" value={item.quantity} onChange={e=>editItem(i,{quantity:Number(e.target.value)})}/></label>
      <label className="field"><span>Material</span><select value={materialKey(item.material)}
       onChange={e=>{const m=materials.find(m=>materialKey(m)===e.target.value);if(m)editItem(i,{material:presetMaterial(m)})}}>
       {!materials.some(m=>materialKey(m)===materialKey(item.material))&&<option value={materialKey(item.material)}>Saved: {item.material.name}, {item.material.thickness} mm</option>}
       {materials.map(m=><option key={m.id} value={materialKey(m)}>{m.name} · {m.type} {m.thickness} mm</option>)}
      </select></label>
     </div>
     <details className="preset-details"><summary>Grain, rotation and ABS</summary>
      <div className="form-grid"><label className="field"><span>Grain direction</span><select value={item.grain} onChange={e=>editItem(i,{grain:e.target.value as GrainAxis})}>
       {['none','x','y'].map(x=><option key={x}>{x}</option>)}</select></label>
       {edges.map(side=><label className="field" key={side}><span>ABS {side}</span><input value={item.abs[side]??''} placeholder="none / ABS 2 mm" onChange={e=>editItem(i,{abs:{...item.abs,[side]:e.target.value||null}})}/></label>)}
      </div><label className="checkline"><input type="checkbox" checked={item.rotationAllowed} onChange={e=>editItem(i,{rotationAllowed:e.target.checked})}/> Allow rotation</label>
     </details>
    </div>)}
   </div>
   <div className="actions">
    <button onClick={()=>setDraft(p=>p?{...p,items:[...p.items,newPresetItem(materials[0])]}:p)}>+ Cut item</button>
    <button className="primary" disabled={busy||validatePreset(draft).length>0} onClick={()=>void save()}>{busy?'Saving…':draftMode==='duplicate'?'Save duplicate':'Save preset'}</button>
    <button onClick={()=>{setDraft(null);setError('');setNotice('Draft discarded without saving.')}}>Cancel</button>
   </div>
   {validatePreset(draft).length>0&&<p className="muted">{validatePreset(draft).join('; ')}</p>}
  </div>}
  <div className="preset-list-head"><label className="field"><span>Find saved preset or item</span><input placeholder="Search presets or items" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <label className="field"><span>Default destination project</span><select value={targetId} onChange={e=>setTargetId(e.target.value)}>
    <option value="">Choose project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
   </select></label>
  </div>
  <div className="preset-category-tree">
   {roots.map(cat=><CategoryBranch key={cat.id} category={cat} all={categories} visible={visible} presets={matches} projects={projects}
    targetId={targetId} onTarget={setTargetId} onInsert={onInsert} onEdit={beginEdit} onDuplicate={beginDuplicate} onCustomize={customize} onDelete={deleteSaved}/>)}
   {orphaned.length>0&&<details className="preset-category-branch"><summary>Unassigned presets ({orphaned.length})</summary>
    <div className="preset-category-content">{orphaned.map(p=><SavedPreset key={p.id} preset={p} categoryName="Unassigned" projects={projects} targetId={targetId}
      onTarget={setTargetId} onInsert={onInsert} onEdit={beginEdit} onDuplicate={beginDuplicate} onCustomize={customize} onDelete={deleteSaved}/>)}</div>
   </details>}
   {!matches.length&&<p className="muted">No matching presets. Create one to begin.</p>}
  </div>
  <div className="actions preset-backups">
   <button onClick={()=>{void exportPresetLibrary().then(json=>download('mobila-cutlist-presets.json',json,'application/json')).catch(onError)}}>Export presets JSON</button>
   <label className="buttonlike">Import presets JSON<input hidden type="file" accept=".json,application/json" onChange={e=>void importBackup(e)}/></label>
  </div>
 </section>
}
