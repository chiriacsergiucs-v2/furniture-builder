import type {Table} from 'dexie'
import {db,defaultCategory,UNCATEGORIZED_ID} from './database.ts'
import type {BuildKit,LibraryMaterial,LibraryRevision,Metadata,PresetCategory,StoredPreset} from './database.ts'
import type {Project} from '../engine/types.ts'
import {validateProject} from '../engine/schema.ts'
import {validatePreset} from '../presets/presets.ts'
import {initializeStorage} from './migration.ts'
import {validateCategory,validateKit} from './repository.ts'

export interface BuildKitBackup {
 kind:'mobila-build-kit-backup'; schemaVersion:1; createdAt:string
 collections:{projects:Project[]; presetCategories:PresetCategory[]; presets:StoredPreset[]; kits:BuildKit[]; materials:LibraryMaterial[]; revisions:LibraryRevision[]}
}
function unique<T>(rows:T[],key:(row:T)=>string,label:string){const ids=new Set<string>();for(const row of rows){const id=key(row);if(!id||ids.has(id))throw Error(`Duplicate or invalid ${label} ID: ${id}`);ids.add(id)}}
export function parseBuildKitBackup(json:string):BuildKitBackup{
 let value:unknown;try{value=JSON.parse(json)}catch{throw Error('Invalid JSON database backup')}
 if(!value||typeof value!=='object')throw Error('Invalid database backup')
 const input=value as Partial<BuildKitBackup>
 if(input.kind!=='mobila-build-kit-backup'||input.schemaVersion!==1||!input.collections)throw Error('Unsupported Build-Kit backup version')
 const c=input.collections
 for(const collection of ['projects','presetCategories','presets','kits','materials','revisions'] as const){if(!Array.isArray(c[collection]))throw Error('Missing backup collection: '+collection)}
 unique(c.projects,p=>p.id,'project');unique(c.presetCategories,x=>x.id,'category');unique(c.presets,x=>x.id,'preset');unique(c.kits,x=>x.id,'kit');unique(c.materials,x=>x.libraryId,'material');unique(c.revisions,x=>x.id,'revision')
 for(const p of c.projects){const errors=validateProject(p);if(errors.length)throw Error('Invalid project backup: '+errors.join('; '))}
 for(const p of c.presets){const errors=validatePreset(p);if(errors.length)throw Error('Invalid preset backup: '+errors.join('; '))
  if(typeof p.categoryId!=='string')throw Error('Preset category ID missing')}
 for(const p of c.presetCategories){const errors=validateCategory(p);if(errors.length)throw Error('Invalid category backup: '+errors.join('; '))}
 for(const k of c.kits){const errors=validateKit(k);if(errors.length)throw Error('Invalid kit backup: '+errors.join('; '))}
 for(const m of c.materials){if(m.schemaVersion!==1||!m.libraryId||!m.id||!m.name||!Number.isSafeInteger(m.thickness)||m.thickness<1)throw Error('Invalid material backup')}
 for(const rev of c.revisions){if(rev.schemaVersion!==1||!rev.id||!rev.entityId||!['project','preset','category','kit','material'].includes(rev.entityType))throw Error('Invalid revision backup')}
 return input as BuildKitBackup
}
export async function exportDatabaseBackup():Promise<string>{
 await initializeStorage()
 const collections=await db.transaction('r',[db.projects,db.presetCategories,db.presets,db.kits,db.materials,db.revisions],async()=>({
  projects:await db.projects.toArray(),presetCategories:await db.presetCategories.toArray(),
  presets:await db.presets.toArray(),kits:await db.kits.toArray(),
  materials:await db.materials.toArray(),revisions:await db.revisions.toArray()
 }))
 return JSON.stringify({kind:'mobila-build-kit-backup',schemaVersion:1,createdAt:new Date().toISOString(),collections},null,2)
}
export async function importDatabaseBackup(json:string):Promise<{imported:Record<string,number>;skipped:Record<string,number>}>{
 const data=parseBuildKitBackup(json)
 await initializeStorage()
 const imported:Record<string,number>={},skipped:Record<string,number>={}
 const c=data.collections
 // Merge missing IDs; never overwrite existing records or erase local projects.
 // Validate references against the combined library before starting to write.
 const existingCategoryIds=new Set((await db.presetCategories.toArray()).map(x=>x.id))
 const allCategoryIds=new Set([...existingCategoryIds,...c.presetCategories.map(x=>x.id),UNCATEGORIZED_ID])
 for(const p of c.presets)if(!allCategoryIds.has(p.categoryId))throw Error('Backup preset category missing: '+p.categoryId)
 for(const k of c.kits)if(!allCategoryIds.has(k.categoryId))throw Error('Backup kit category missing: '+k.categoryId)
 await db.transaction('rw',[db.projects,db.presetCategories,db.presets,db.kits,db.materials,db.revisions,db.metadata],async()=>{
  if(!await db.presetCategories.get(UNCATEGORIZED_ID))await db.presetCategories.put(defaultCategory())
  const merge=async <T>(name:string,table:Table<T,string>,rows:T[],getId:(item:T)=>string)=>{
   imported[name]=0;skipped[name]=0
   for(const row of rows){if(await table.get(getId(row))){skipped[name]++;continue}await table.put(structuredClone(row));imported[name]++}
  }
  await merge('projects',db.projects,c.projects,x=>x.id)
  await merge('presetCategories',db.presetCategories,c.presetCategories,x=>x.id)
  await merge('presets',db.presets,c.presets,x=>x.id)
  await merge('kits',db.kits,c.kits,x=>x.id)
  await merge('materials',db.materials,c.materials,x=>x.libraryId)
  await merge('revisions',db.revisions,c.revisions,x=>x.id)
  const record:Metadata={key:'backup:last-import',value:{imported,skipped},updatedAt:new Date().toISOString()}
  await db.metadata.put(record)
 })
 return {imported,skipped}
}
