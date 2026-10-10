import {useEffect,useState} from 'react'
import type {ChangeEvent} from 'react'
import type {Part,Project,EdgeName,GrainAxis} from '../engine/types.ts'
import {download} from '../import-export/files.ts'
import {createPreset,instantiatePreset,newPresetItem,presetFromParts,presetMaterial,validatePreset} from '../presets/presets.ts'
import type {CutlistPreset,PresetItem,PresetMaterial} from '../presets/presets.ts'
import {deletePreset,exportPresetLibrary,importPresetLibrary,listPresets,savePreset} from '../presets/storage.ts'
import {listCategories,saveCategory,deleteCategory} from '../db/repository.ts'
import type {PresetCategory,StoredPreset} from '../db/database.ts'
import {UNCATEGORIZED_ID} from '../db/database.ts'

const sides:EdgeName[]=['top','right','bottom','left']
const createEmpty=(project:Project)=>createPreset('',[newPresetItem(project.materials[0])])
const materialKey=(m:PresetMaterial)=>JSON.stringify({name:m.name,type:m.type,thickness:m.thickness,finish:m.finish??''})
function message(e:unknown){return e instanceof Error?e.message:String(e)}
export function PresetManager({project,onInsert}:{project:Project;onInsert:(parts:Part[])=>void}){
 const [library,setLibrary]=useState<StoredPreset[]>([])
 const [categories,setCategories]=useState<PresetCategory[]>([])
 const [newCategory,setNewCategory]=useState('')
 const [categoryFilter,setCategoryFilter]=useState('')
 const [selectedCategory,setSelectedCategory]=useState(UNCATEGORIZED_ID)
 useEffect(()=>{let mounted=true;void Promise.all([listPresets(),listCategories()]).then(([saved,groups])=>{if(mounted){setLibrary(saved);setCategories(groups)}}).catch(e=>{if(mounted)setError(message(e))});return()=>{mounted=false}},[])
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [draft,setDraft]=useState<CutlistPreset|null>(null)
 const [copies,setCopies]=useState<Record<string,number>>({})
 const [filter,setFilter]=useState('')
 const onError=(e:unknown)=>{setError(message(e));setNotice('')}
 const start=()=>{if(!project.materials.length){setError('Add a material to your project before creating a preset.');return}setDraft(createEmpty(project));setSelectedCategory(UNCATEGORIZED_ID);setError('');setNotice('')}
 const fromParts=()=>{try{if(!project.parts.length)throw Error('Add parts to the project first.');setDraft(presetFromParts(project));setSelectedCategory(UNCATEGORIZED_ID);setError('');setNotice('')}catch(e){onError(e)}}
 const editItem=(idx:number,update:Partial<PresetItem>)=>setDraft(p=>p?{...p,items:p.items.map((item,i)=>i===idx?{...item,...update}:item)}:p)
 const save=async()=>{if(!draft)return;try{const issues=validatePreset(draft);if(issues.length)throw Error(issues.join('; '));setLibrary(await savePreset({...draft,categoryId:selectedCategory}));setNotice(`Saved preset “${draft.label}” with ${draft.items.length} cut items.`);setError('');setDraft(null)}catch(e){onError(e)}}
 const add=(preset:CutlistPreset)=>{try{const parts=instantiatePreset(preset,project,copies[preset.id]??1);onInsert(parts);setNotice(`Added ${parts.length} cut rows (${parts.reduce((n,p)=>n+p.quantity,0)} pieces) from “${preset.label}”.`);setError('')}catch(e){onError(e)}}
 const remove=async(p:CutlistPreset)=>{if(!window.confirm(`Delete preset “${p.label}”? The parts already added to projects will remain.`))return;try{setLibrary(await deletePreset(p.id));if(draft?.id===p.id)setDraft(null);setNotice(`Deleted preset “${p.label}”.`);setError('')}catch(e){onError(e)}}
 const importBackup=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const saved=await importPresetLibrary(await file.text());setLibrary(saved);setNotice(`Imported preset library; ${saved.length} presets available.`);setError('')}catch(err){onError(err)}}
 const filtered=library.filter(p=>p.label.toLowerCase().includes(filter.toLowerCase())&&(!categoryFilter||p.categoryId===categoryFilter))
 const createCategory=async()=>{try{if(!newCategory.trim())throw Error('Enter a category name.');const date=new Date().toISOString();await saveCategory({schemaVersion:1,id:crypto.randomUUID(),name:newCategory.trim(),parentId:null,sortOrder:categories.length,createdAt:date,updatedAt:date});setCategories(await listCategories());setNewCategory('');setNotice('Category saved');setError('')}catch(e){onError(e)}}
 const removeCategory=async()=>{if(!selectedCategory||selectedCategory===UNCATEGORIZED_ID)return;if(!confirm('Delete this category? Its presets become Uncategorized.'))return;try{await deleteCategory(selectedCategory);setCategories(await listCategories());setLibrary(await listPresets());setSelectedCategory(UNCATEGORIZED_ID);setCategoryFilter('');setError('')}catch(e){onError(e)}}
 return <section id="presets" className="card" aria-label="Presets"><div className="section-head"><h2>Presets <small>({library.length} saved)</small></h2><div className="actions compact-actions"><button onClick={start}>+ Create preset</button><button disabled={!project.parts.length} onClick={fromParts}>Save project parts as preset</button></div></div>
 <p className="muted">Save a named set of cut items (for example, “Drawer top”) and reuse it in this or another project. Presets are stored on this device; inserted parts remain independently editable.</p>
 <div className="preset-category-editor"><label className="field"><span>New category</span><input value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Drawers, Cabinets, Shelves…" /></label><button onClick={()=>void createCategory()}>+ Save category</button></div>
 {error&&<p className="preset-error" role="alert">{error}</p>}{notice&&<p className="preset-success" role="status">{notice}</p>}
 {draft&&<div className="preset-editor"><h3>{library.some(p=>p.id===draft.id)?'Edit preset':'New preset'}</h3><label className="field"><span>Category</span><select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}>{categories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label><button disabled={selectedCategory===UNCATEGORIZED_ID} onClick={()=>void removeCategory()}>Delete category</button><label className="field"><span>Preset label</span><input value={draft.label} placeholder="Drawer top" onChange={e=>setDraft(p=>p?{...p,label:e.target.value}:p)}/></label>
 <div className="preset-items">{draft.items.map((item,i)=><div className="part-card" key={i}><div className="section-head"><strong>Cut item {i+1}</strong><button className="danger" disabled={draft.items.length===1} onClick={()=>setDraft(p=>p?{...p,items:p.items.filter((_,j)=>j!==i)}:p)}>Remove item</button></div><div className="form-grid">
 <label className="field"><span>Item label</span><input value={item.label} onChange={e=>editItem(i,{label:e.target.value})}/></label>
 <label className="field"><span>Width mm</span><input type="number" min="1" step="1" value={item.width} onChange={e=>editItem(i,{width:Number(e.target.value)})}/></label>
 <label className="field"><span>Height mm</span><input type="number" min="1" step="1" value={item.height} onChange={e=>editItem(i,{height:Number(e.target.value)})}/></label>
 <label className="field"><span>Quantity per preset</span><input type="number" min="1" step="1" value={item.quantity} onChange={e=>editItem(i,{quantity:Number(e.target.value)})}/></label>
 <label className="field"><span>Material</span><select value={materialKey(item.material)} onChange={e=>{const m=project.materials.find(m=>materialKey(m)===e.target.value);if(m)editItem(i,{material:presetMaterial(m)})}}>{!project.materials.some(m=>materialKey(m)===materialKey(item.material))&&<option value={materialKey(item.material)}>Saved: {item.material.name}, {item.material.thickness} mm</option>}{project.materials.map(m=><option value={materialKey(m)} key={m.id}>{m.name} · {m.type} {m.thickness} mm</option>)}</select></label>
 </div><details className="preset-details"><summary>Rotation, grain and ABS edges</summary><div className="form-grid"><label className="field"><span>Grain direction</span><select value={item.grain} onChange={e=>editItem(i,{grain:e.target.value as GrainAxis})}>{['none','x','y'].map(x=><option key={x}>{x}</option>)}</select></label>{sides.map(side=><label className="field" key={side}><span>ABS {side}</span><input placeholder="none / ABS 2 mm" value={item.abs[side]??''} onChange={e=>editItem(i,{abs:{...item.abs,[side]:e.target.value||null}})}/></label>)}</div><label className="checkline"><input type="checkbox" checked={item.rotationAllowed} onChange={e=>editItem(i,{rotationAllowed:e.target.checked})}/> Allow rotation</label></details></div>)}</div>
 <div className="actions"><button onClick={()=>setDraft(p=>p?{...p,items:[...p.items,newPresetItem(project.materials[0])]}:p)}>+ Cut item</button><button className="primary" disabled={validatePreset(draft).length>0} onClick={()=>void save()}>Save preset</button><button onClick={()=>setDraft(null)}>Cancel</button></div>{validatePreset(draft).length>0&&<p className="muted">{validatePreset(draft).join('; ')}</p>}</div>}
 <div className="preset-list-head"><label className="field"><span>Filter by category</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="">All categories</option>{categories.map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label><label className="field"><span>Find saved preset</span><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search presets"/></label></div>
 <div className="preset-list">{filtered.map(p=><article className="preset-card" key={p.id}><div><strong>{p.label}</strong><small> · {categories.find(c=>c.id===p.categoryId)?.name??'Uncategorized'}</small><p>{p.items.length} cut items · {p.items.reduce((n,item)=>n+item.quantity,0)} pieces per preset</p><ul>{p.items.map((item,i)=><li key={i}>{item.label}: {item.width} × {item.height} mm · {item.quantity}× · {item.material.name}</li>)}</ul></div><div className="preset-controls"><label className="field"><span>Sets to add</span><input type="number" step="1" min="1" value={copies[p.id]??1} onChange={e=>setCopies(prev=>({...prev,[p.id]:Number(e.target.value)}))}/></label><button className="primary" onClick={()=>add(p)}>Add to project</button><button onClick={()=>{setDraft(structuredClone(p));setSelectedCategory(p.categoryId);setError('');setNotice('')}}>Edit</button><button className="danger" onClick={()=>void remove(p)}>Delete</button></div></article>)}</div>
 {!filtered.length&&<p className="muted">{library.length?'No matching presets.':'No presets saved yet.'}</p>}
 <div className="actions preset-backups"><button onClick={()=>{void exportPresetLibrary().then(json=>download('mobila-cutlist-presets.json',json,'application/json')).catch(onError)}}>Export presets JSON</button><label className="buttonlike">Import presets JSON<input type="file" accept=".json,application/json" hidden onChange={e=>void importBackup(e)}/></label></div>
 </section>
}
