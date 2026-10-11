import type {CutlistPreset} from './presets.ts'
import {validatePreset} from './presets.ts'
import {db,UNCATEGORIZED_ID,now} from '../db/database.ts'
import type {StoredPreset,LibraryRevision} from '../db/database.ts'
import {initializeStorage} from '../db/migration.ts'

function validateAll(values:unknown):CutlistPreset[]{
 if(!Array.isArray(values)||values.length>1000)throw Error('Invalid preset library (maximum 1000 presets)')
 const ids=new Set<string>()
 for(const item of values){const errors=validatePreset(item)
  if(errors.length)throw Error('Invalid preset: '+errors.join('; '))
  if(ids.has(item.id))throw Error('Duplicate preset IDs');ids.add(item.id)
 }
 return values as CutlistPreset[]
}
const makeRevision=(p:StoredPreset,action:LibraryRevision['action']):LibraryRevision=>({schemaVersion:1,id:crypto.randomUUID(),entityType:'preset',entityId:p.id,action,createdAt:now(),snapshot:structuredClone(p)})
export async function listPresets():Promise<StoredPreset[]>{await initializeStorage();return db.presets.orderBy('updatedAt').reverse().toArray()}
export async function savePreset(preset:CutlistPreset):Promise<StoredPreset[]>{
 const errors=validatePreset(preset);if(errors.length)throw Error(errors.join('; '))
 await initializeStorage()
 await db.transaction('rw',db.presets,db.presetCategories,db.revisions,async()=>{
  const existing=await db.presets.get(preset.id)
  const categoryId=(preset as StoredPreset).categoryId??existing?.categoryId??UNCATEGORIZED_ID
  if(!await db.presetCategories.get(categoryId))throw Error('Preset category is missing')
  // The revision is advanced atomically on explicit Save, not during editing or insertion.
  // Unversioned legacy records are revision 1; their first edit becomes revision 2.
  const revision=existing?(existing.revision??1)+1:(preset.revision??1)
  if(!Number.isSafeInteger(revision))throw Error('Preset revision overflow')
  const stored={...structuredClone(preset),categoryId,revision,updatedAt:now()}
  await db.presets.put(stored)
  await db.revisions.add(makeRevision(stored,existing?'update':'create'))
 })
 return listPresets()
}
export async function deletePreset(id:string):Promise<StoredPreset[]>{
 await initializeStorage()
 await db.transaction('rw',db.presets,db.revisions,async()=>{const old=await db.presets.get(id);if(old){await db.presets.delete(id);await db.revisions.add(makeRevision(old,'delete'))}})
 return listPresets()
}
export async function exportPresetLibrary():Promise<string>{
 return JSON.stringify({schemaVersion:1,kind:'mobila-cutlist-presets',presets:await listPresets()},null,2)
}
export async function importPresetLibrary(json:string):Promise<StoredPreset[]>{
 let value:unknown;try{value=JSON.parse(json)}catch{throw Error('Invalid preset backup JSON')}
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid preset backup')
 const backup=value as Record<string,unknown>
 if(backup.schemaVersion!==1||backup.kind!=='mobila-cutlist-presets')throw Error('Unsupported preset backup format')
 const items=validateAll(backup.presets)
 await initializeStorage()
 // Validate and commit all imports atomically. Existing IDs are remapped without overwriting.
 await db.transaction('rw',db.presets,db.revisions,async()=>{
  const existing=new Set((await db.presets.toArray()).map(p=>p.id))
  for(const preset of items){const stored:StoredPreset={...structuredClone(preset),categoryId:UNCATEGORIZED_ID}
   if(existing.has(stored.id))stored.id=crypto.randomUUID()
   existing.add(stored.id)
   await db.presets.put(stored)
   await db.revisions.add(makeRevision(stored,'import'))
  }
 })
 return listPresets()
}
