import {useState} from 'react'
import type {ChangeEvent} from 'react'
import type {Part,Project,EdgeName,GrainAxis} from '../engine/types.ts'
import {download} from '../import-export/files.ts'
import {createPreset,instantiatePreset,newPresetItem,presetFromParts,presetMaterial,validatePreset} from '../presets/presets.ts'
import type {CutlistPreset,PresetItem,PresetMaterial} from '../presets/presets.ts'
import {deletePreset,exportPresetLibrary,importPresetLibrary,listPresets,savePreset} from '../presets/storage.ts'

const sides:EdgeName[]=['top','right','bottom','left']
const createEmpty=(project:Project)=>createPreset('',[newPresetItem(project.materials[0])])
const materialKey=(m:PresetMaterial)=>JSON.stringify(presetMaterial(m as Parameters<typeof presetMaterial>[0]))
function message(e:unknown){return e instanceof Error?e.message:String(e)}
export function PresetManager({project,onInsert}:{project:Project;onInsert:(parts:Part[])=>void}){
 const [library,setLibrary]=useState<CutlistPreset[]>(()=>{try{return listPresets()}catch{return []}})
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [draft,setDraft]=useState<CutlistPreset|null>(null)
 const [copies,setCopies]=useState<Record<string,number>>({})
 const [filter,setFilter]=useState('')
 const onError=(e:unknown)=>{setError(message(e));setNotice('')}
 const start=()=>{if(!project.materials.length){setError('Add a material to your project before creating a preset.');return}setDraft(createEmpty(project));setError('');setNotice('')}
 const fromParts=()=>{try{if(!project.parts.length)throw Error('Add parts to the project first.');setDraft(presetFromParts(project));setError('');setNotice('')}catch(e){onError(e)}}
 const editItem=(idx:number,update:Partial<PresetItem>)=>setDraft(p=>p?{...p,items:p.items.map((item,i)=>i===idx?{...item,...update}:item)}:p)
 const save=()=>{if(!draft)return;try{const issues=validatePreset(draft);if(issues.length)throw Error(issues.join('; '));setLibrary(savePreset(draft));setNotice('Saved preset “'+draft.label+'” with '+draft.items.length+' cut items.');setError('');setDraft(null)}catch(e){onError(e)}}
 const add=(preset:CutlistPreset)=>{try{const parts=instantiatePreset(preset,project,copies[preset.id]??1);onInsert(parts);setNotice('Added '+parts.length+' cut rows ('+parts.reduce((n,p)=>n+p.quantity,0)+' pieces) from “'+preset.label+'”.');setError('')}catch(e){onError(e)}}
 const remove=(p:CutlistPreset)=>{if(!window.confirm('Delete preset “'+p.label+'”? The parts already added to projects will remain.'))return;try{setLibrary(deletePreset(p.id));if(draft?.id===p.id)setDraft(null);setNotice('Deleted preset “'+p.label+'”.');setError('')}catch(e){onError(e)}}
 const importBackup=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{const saved=importPresetLibrary(await file.text());setLibrary(saved);setNotice('Imported preset library; '+saved.length+' presets available.');setError('')}catch(err){onError(err)}}
 const filtered=library.filter(p=>p.label.toLowerCase().includes(filter.toLowerCase()))
 return <section id="presets" className="card" aria-label="Presets"><div className="section-head"><h2>Presets <small>({library.length} saved)</small></h2><div className="actions compact-actions"><button onClick={start}>+ Create preset</button><button disabled={!project.parts.length} onClick={fromParts}>Save project parts as preset</button></div></div>
 <p className="muted">Save a named set of cut items (for example, “Drawer top”) and reuse it in this or another project. Presets are stored on this device; inserted parts remain independently editable.</p>
 {error&&<p className="preset-error" role="alert">{error}</p>}{notice&&<p className="preset-success" role="status">{notice}</p>}
 {draft&&<div className="preset-editor"><h3>{library.some(p=>p.id===draft.id)?'Edit preset':'New preset'}</h3><label className="field"><span>Preset label</span><input value={draft.label} placeholder="Drawer top" onChange={e=>setDraft(p=>p?{...p,label:e.target.value}:p)}/></label>
 <div className="preset-items">{draft.items.map((item,i)=><div className="part-card" key={i}><div className="section-head"><strong>Cut item {i+1}</strong><button className="danger" disabled={draft.items.length===1} onClick={()=>setDraft(p=>p?{...p,items:p.items.filter((_,j)=>j!==i)}:p)}>Remove item</button></div><div className="form-grid">
 <label className="field"><span>Item label</span><input value={item.label} onChange={e=>editItem(i,{label:e.target.value})}/></label>
 <label className="field"><span>Width mm</span><input type="number" min="1" step="1" value={item.width} onChange={e=>editItem(i,{width:Number(e.target.value)})}/></label>
 <label className="field"><span>Height mm</span><input type="number" min="1" step="1" value={item.height} onChange={e=>editItem(i,{height:Number(e.target.value)})}/></label>
 <label className="field"><span>Quantity per preset</span><input type="number" min="1" step="1" value={item.quantity} onChange={e=>editItem(i,{quantity:Number(e.target.value)})}/></label>
 <label className="field"><span>Material</span><select value={materialKey(item.material)} onChange={e=>{const m=project.materials.find(m=>materialKey(m)===e.target.value);if(m)editItem(i,{material:presetMaterial(m)})}}>{!project.materials.some(m=>materialKey(m)===materialKey(item.material))&&<option value={materialKey(item.material)}>Saved: {item.material.name}, {item.material.thickness} mm</option>}{project.materials.map(m=><option value={materialKey(m)} key={m.id}>{m.name} · {m.type} {m.thickness} mm</option>)}</select></label>
 </div><details className="preset-details"><summary>Rotation, grain and ABS edges</summary><div className="form-grid"><label className="field"><span>Grain direction</span><select value={item.grain} onChange={e=>editItem(i,{grain:e.target.value as GrainAxis})}>{['none','x','y'].map(x=><option key={x}>{x}</option>)}</select></label>{sides.map(side=><label className="field" key={side}><span>ABS {side}</span><input placeholder="none / ABS 2 mm" value={item.abs[side]??''} onChange={e=>editItem(i,{abs:{...item.abs,[side]:e.target.value||null}})}/></label>)}</div><label className="checkline"><input type="checkbox" checked={item.rotationAllowed} onChange={e=>editItem(i,{rotationAllowed:e.target.checked})}/> Allow rotation</label></details></div>)}</div>
 <div className="actions"><button onClick={()=>setDraft(p=>p?{...p,items:[...p.items,newPresetItem(project.materials[0])]}:p)}>+ Cut item</button><button className="primary" disabled={validatePreset(draft).length>0} onClick={save}>Save preset</button><button onClick={()=>setDraft(null)}>Cancel</button></div>{validatePreset(draft).length>0&&<p className="muted">{validatePreset(draft).join('; ')}</p>}</div>}
 <div className="preset-list-head"><label className="field"><span>Find saved preset</span><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search presets"/></label></div>
 <div className="preset-list">{filtered.map(p=><article className="preset-card" key={p.id}><div><strong>{p.label}</strong><p>{p.items.length} cut items · {p.items.reduce((n,item)=>n+item.quantity,0)} pieces per preset</p><ul>{p.items.map((item,i)=><li key={i}>{item.label}: {item.width} × {item.height} mm · {item.quantity}× · {item.material.name}</li>)}</ul></div><div className="preset-controls"><label className="field"><span>Sets to add</span><input type="number" step="1" min="1" value={copies[p.id]??1} onChange={e=>setCopies(prev=>({...prev,[p.id]:Number(e.target.value)}))}/></label><button className="primary" onClick={()=>add(p)}>Add to project</button><button onClick={()=>{setDraft(structuredClone(p));setError('');setNotice('')}}>Edit</button><button className="danger" onClick={()=>remove(p)}>Delete</button></div></article>)}</div>
 {!filtered.length&&<p className="muted">{library.length?'No matching presets.':'No presets saved yet.'}</p>}
 <div className="actions preset-backups"><button onClick={()=>{try{download('mobila-cutlist-presets.json',exportPresetLibrary(),'application/json')}catch(e){onError(e)}}}>Export presets JSON</button><label className="buttonlike">Import presets JSON<input type="file" accept=".json,application/json" hidden onChange={e=>void importBackup(e)}/></label></div>
 </section>
}
