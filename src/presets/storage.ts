import type {CutlistPreset} from './presets.ts'
import {validatePreset} from './presets.ts'
const key='mobila-cutlist:presets:v1'
const getStore=():Storage=>{
 try{const store=window.localStorage,probe='mobila-cutlist:probe';store.setItem(probe,'1');store.removeItem(probe);return store}
 catch{throw Error('Browser storage unavailable; presets cannot be saved. Check browser storage permissions.')}
}
const decode=(raw:string):CutlistPreset[]=>{
 let value:unknown
 try{value=JSON.parse(raw)}catch{throw Error('Stored presets JSON is corrupted. Existing data was not overwritten.')}
 if(!Array.isArray(value))throw Error('Invalid preset library format')
 if(value.length>1000)throw Error('Preset library exceeds the 1000-preset limit')
 const ids=new Set<string>()
 for(const preset of value){const errors=validatePreset(preset);if(errors.length)throw Error('Invalid preset: '+errors.join('; '));const id=(preset as CutlistPreset).id;if(ids.has(id))throw Error('Duplicate preset IDs');ids.add(id)}
 return value as CutlistPreset[]
}
export function listPresets():CutlistPreset[]{const raw=getStore().getItem(key);return raw?decode(raw).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)):[]}
const storeAll=(items:CutlistPreset[]):CutlistPreset[]=>{
 if(items.length>1000)throw Error('A maximum of 1000 presets is supported')
 const checked=decode(JSON.stringify(items))
 try{getStore().setItem(key,JSON.stringify(checked))}catch{throw Error('Could not save presets. Browser storage may be full. Export a backup and free space.')}
 return checked
}
export function savePreset(preset:CutlistPreset):CutlistPreset[]{
 const errors=validatePreset(preset);if(errors.length)throw Error(errors.join('; '))
 const existing=listPresets()
 const stored={...structuredClone(preset),updatedAt:new Date().toISOString()}
 return storeAll([stored,...existing.filter(p=>p.id!==stored.id)])
}
export function deletePreset(id:string):CutlistPreset[]{return storeAll(listPresets().filter(p=>p.id!==id))}
export function exportPresetLibrary():string{return JSON.stringify({schemaVersion:1,kind:'mobila-cutlist-presets',presets:listPresets()},null,2)}
export function importPresetLibrary(json:string):CutlistPreset[]{
 let value:unknown;try{value=JSON.parse(json)}catch{throw Error('Invalid preset backup JSON')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid preset backup')
 const backup=value as Record<string,unknown>
 if(backup.schemaVersion!==1||backup.kind!=='mobila-cutlist-presets')throw Error('Unsupported preset backup format')
 const incoming=decode(JSON.stringify(backup.presets))
 const prior=listPresets()
 const ids=new Set(prior.map(p=>p.id))
 const imported=incoming.map(p=>{const item=structuredClone(p);if(ids.has(item.id))item.id=crypto.randomUUID();ids.add(item.id);return item})
 return storeAll([...imported,...prior])
}
