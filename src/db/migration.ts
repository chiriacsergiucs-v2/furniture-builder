import type {Project} from '../engine/types.ts'
import {validateProject} from '../engine/schema.ts'
import {validateResult} from '../engine/validate.ts'
import type {CutlistPreset} from '../presets/presets.ts'
import {validatePreset} from '../presets/presets.ts'
import {db as defaultDb,defaultCategory,MIGRATION_KEY,UNCATEGORIZED_ID,now} from './database.ts'
import type {FurnitureDatabase,MigrationReport,StoredPreset,LibraryMaterial} from './database.ts'

const projectPrefix='mobila-cutlist:project:'
const indexKey='mobila-cutlist:project-index'
const presetsKey='mobila-cutlist:presets:v1'

/** Legacy storage is read-only forever: never remove or alter these keys. */
export function readLegacySnapshot(store:Storage|null):{
 projects:Project[]; presets:StoredPreset[]; warnings:string[]; skipped:number
}{
 const projects:Project[]=[],presets:StoredPreset[]=[],warnings:string[]=[]
 let skipped=0
 if(!store)return {projects,presets,warnings:['localStorage is unavailable; existing browser data could not be inspected.'],skipped}
 const ids=new Set<string>()
 try{
  const raw=store.getItem(indexKey)
  if(raw){const index:unknown=JSON.parse(raw);if(!Array.isArray(index))throw Error('Index must be an array')
   for(const id of index)if(typeof id==='string')ids.add(id)
  }
 }catch{warnings.push('Legacy project index is invalid; discovered project keys were still scanned.')}
 try{for(let i=0;i<store.length;i++){const key=store.key(i);if(key?.startsWith(projectPrefix))ids.add(key.slice(projectPrefix.length))}}
 catch{warnings.push('Unable to enumerate all legacy project keys')}
 for(const id of ids){
  try{
   const raw=store.getItem(projectPrefix+id)
   if(!raw){warnings.push('Missing legacy project '+id);skipped++;continue}
   const p:unknown=JSON.parse(raw)
   if(validateProject(p).length||(p as Project).id!==id)throw Error('Invalid project data')
   const project=structuredClone(p as Project)
   if(project.lastResult){try{if(validateResult(project,project.lastResult).length)throw Error('Invalid result')}catch{project.lastResult=undefined;warnings.push('Discarded invalid cached optimization for project '+id)}}
   projects.push(project)
  }catch{warnings.push('Legacy project '+id+' could not be migrated; its original localStorage record is unchanged.');skipped++}
 }
 try{
  const raw=store.getItem(presetsKey)
  if(raw){const data:unknown=JSON.parse(raw)
   if(!Array.isArray(data))throw Error('Preset library must be an array')
   const seen=new Set<string>()
   for(const item of data){
    if(validatePreset(item).length||seen.has((item as CutlistPreset).id)){
     warnings.push('An invalid or duplicate legacy preset was left in localStorage.');skipped++;continue
    }
    const p=item as CutlistPreset;seen.add(p.id)
    presets.push({...structuredClone(p),categoryId:UNCATEGORIZED_ID})
   }
  }
 }catch{warnings.push('Legacy preset library is malformed; original data was preserved.');skipped++}
 return {projects,presets,warnings,skipped}
}
export async function migrateLocalStorage(database:FurnitureDatabase=defaultDb,source?:Storage|null):Promise<MigrationReport>{
 await database.open()
 const existing=await database.metadata.get(MIGRATION_KEY)
 if(existing)return existing.value as MigrationReport
 let legacy:Storage|null=source??null
 if(source===undefined){try{legacy=window.localStorage}catch{legacy=null}}
 const snapshot=readLegacySnapshot(legacy)
 let projects=0,presets=0
 const report:MigrationReport={status:'completed',projects:0,presets:0,skipped:snapshot.skipped,warnings:snapshot.warnings,completedAt:now(),sourceKeysPreserved:true}
 // Entire transfer and completion marker are one atomic IndexedDB transaction.
 // Existing Dexie records always win. On failure, all partial writes roll back.
 await database.transaction('rw',database.projects,database.presets,database.presetCategories,database.materials,database.metadata,async()=>{
  if(await database.metadata.get(MIGRATION_KEY))return
  if(!await database.presetCategories.get(UNCATEGORIZED_ID))await database.presetCategories.put(defaultCategory())
  for(const project of snapshot.projects){
   if(await database.projects.get(project.id))continue
   await database.projects.put(project)
   projects++
   for(const material of project.materials){
    const libraryId=`${project.id}:${material.id}`
    const entry:LibraryMaterial={...material,libraryId,sourceProjectId:project.id,schemaVersion:1,updatedAt:project.updatedAt}
    if(!await database.materials.get(libraryId))await database.materials.put(entry)
   }
  }
  for(const preset of snapshot.presets){
   if(await database.presets.get(preset.id))continue
   await database.presets.put(preset)
   presets++
  }
  report.projects=projects;report.presets=presets
  await database.metadata.put({key:MIGRATION_KEY,value:report,updatedAt:report.completedAt})
 })
 return (await database.metadata.get(MIGRATION_KEY))!.value as MigrationReport
}
let startPromise:Promise<MigrationReport>|null=null
export function initializeStorage():Promise<MigrationReport>{
 if(!startPromise)startPromise=migrateLocalStorage().catch(err=>{startPromise=null;throw err})
 return startPromise
}
