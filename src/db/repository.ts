import type {Project,Material} from '../engine/types.ts'
import {validateProject,integer,safeString} from '../engine/schema.ts'
import {validateResult} from '../engine/validate.ts'
import {db,defaultCategory,now,UNCATEGORIZED_ID} from './database.ts'
import type {BuildKit,KitItem,LibraryMaterial,PresetCategory,LibraryRevision,RevisionEntity} from './database.ts'
import {initializeStorage} from './migration.ts'

export class StorageError extends Error {constructor(message:string){super(message);this.name='StorageError'}}
const fail=(e:unknown)=>{throw new StorageError(e instanceof Error?e.message:String(e))}
function logRevision(entityType:RevisionEntity,entityId:string,action:LibraryRevision['action'],snapshot:unknown):LibraryRevision{
 return {id:crypto.randomUUID(),schemaVersion:1,entityType,entityId,action,snapshot:structuredClone(snapshot),createdAt:now()}
}
export function cleanProject(value:Project):Project{
 const errors=validateProject(value)
 if(errors.length)throw new StorageError('Invalid project: '+errors.join('; '))
 const project=structuredClone(value)
 if(project.lastResult){try{if(validateResult(project,project.lastResult).length)project.lastResult=undefined}catch{project.lastResult=undefined}}
 return project
}
export async function listProjects():Promise<Project[]>{
 await initializeStorage()
 const values=await db.projects.toArray()
 return values.flatMap(p=>{try{return [cleanProject(p)]}catch{return []}}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
}
export async function getProject(id:string){await initializeStorage();const project=await db.projects.get(id);return project?cleanProject(project):undefined}
export async function saveProject(input:Project):Promise<Project>{
 await initializeStorage()
 const project=cleanProject(input);project.updatedAt=now()
 try{
  await db.transaction('rw',db.projects,db.materials,db.revisions,async()=>{
   const previous=await db.projects.get(project.id)
   await db.projects.put(project)
   const wanted=new Set<string>()
   for(const material of project.materials){
    const libraryId=`${project.id}:${material.id}`;wanted.add(libraryId)
    const entry:LibraryMaterial={...material,libraryId,sourceProjectId:project.id,schemaVersion:1,updatedAt:project.updatedAt}
    await db.materials.put(entry)
   }
   // Project-linked materials are mirrored, not shared with other projects.
   const old=await db.materials.where('sourceProjectId').equals(project.id).toArray()
   await db.materials.bulkDelete(old.filter(m=>!wanted.has(m.libraryId)).map(m=>m.libraryId))
   const priorFingerprint=previous&&JSON.stringify({...previous,updatedAt:'',lastResult:undefined})
   const newFingerprint=JSON.stringify({...project,updatedAt:'',lastResult:undefined})
   if(priorFingerprint!==newFingerprint)await db.revisions.add(logRevision('project',project.id,previous?'update':'create',{...project,lastResult:undefined}))
  })
  return project
 }catch(e){return fail(e)}
}
export async function removeProject(id:string):Promise<void>{
 await initializeStorage()
 try{await db.transaction('rw',db.projects,db.materials,db.revisions,async()=>{
  const original=await db.projects.get(id)
  if(!original)return
  await db.revisions.add(logRevision('project',id,'delete',{...original,lastResult:undefined}))
  await db.projects.delete(id)
  await db.materials.where('sourceProjectId').equals(id).delete()
 })}catch(e){fail(e)}
}
export async function duplicateProject(p:Project):Promise<Project>{
 const stamp=now();return saveProject({...structuredClone(p),id:crypto.randomUUID(),name:p.name+' (copy)',createdAt:stamp,updatedAt:stamp,lastResult:undefined})
}
export function backupProject(p:Project):string{return JSON.stringify({...cleanProject(p),lastResult:undefined},null,2)}
export async function restoreProject(json:string,overwrite=false):Promise<Project>{
 let value:unknown
 try{value=JSON.parse(json)}catch{throw new StorageError('Invalid JSON backup')}
 const project=cleanProject(value as Project)
 if(await getProject(project.id)&&!overwrite)throw new StorageError('Project already exists; confirm overwrite or import a different ID.')
 return saveProject({...project,lastResult:undefined})
}
export async function listCategories():Promise<PresetCategory[]>{await initializeStorage();return db.presetCategories.orderBy('sortOrder').toArray()}
export function validateCategory(cat:PresetCategory):string[]{
 const problems:string[]=[]
 if(cat.schemaVersion!==1||!safeString(cat.id)||!cat.id)problems.push('Invalid category ID/version')
 if(!safeString(cat.name)||!cat.name.trim())problems.push('Category needs a name')
 if(!(cat.parentId===null||safeString(cat.parentId)))problems.push('Invalid parent ID')
 if(!integer(cat.sortOrder))problems.push('Invalid category order')
 return problems
}
export async function saveCategory(category:PresetCategory):Promise<void>{
 await initializeStorage()
 const problems=validateCategory(category);if(problems.length)throw new StorageError(problems.join('; '))
 if(category.id===UNCATEGORIZED_ID&&(category.parentId!==null||category.name!=='Uncategorized'))throw new StorageError('Cannot modify system category')
 try{await db.transaction('rw',db.presetCategories,db.revisions,async()=>{
  if(category.parentId){if(category.parentId===category.id)throw Error('Category cannot be its own parent')
   let cursor=category.parentId;const seen=new Set([category.id]);while(cursor){if(seen.has(cursor))throw Error('Category cycle detected');seen.add(cursor);const p=await db.presetCategories.get(cursor);if(!p)throw Error('Parent category missing');cursor=p.parentId||''}
  }
  const old=await db.presetCategories.get(category.id)
  await db.presetCategories.put({...category,updatedAt:now()})
  await db.revisions.add(logRevision('category',category.id,old?'update':'create',category))
 })}catch(e){fail(e)}
}
export async function deleteCategory(id:string):Promise<void>{
 await initializeStorage();if(id===UNCATEGORIZED_ID)throw new StorageError('Cannot delete system category')
 await db.transaction('rw',db.presetCategories,db.presets,db.kits,db.revisions,async()=>{
  const cat=await db.presetCategories.get(id);if(!cat)return
  if(await db.presetCategories.where('parentId').equals(id).count())throw Error('Move child categories before deleting')
  await db.presets.where('categoryId').equals(id).modify({categoryId:UNCATEGORIZED_ID})
  await db.kits.where('categoryId').equals(id).modify({categoryId:UNCATEGORIZED_ID})
  await db.presetCategories.delete(id)
  await db.revisions.add(logRevision('category',id,'delete',cat))
 })
}
export function validateKit(kit:BuildKit):string[]{
 const errors:string[]=[]
 if(kit.schemaVersion!==1||!safeString(kit.id)||!kit.id||!safeString(kit.label)||!kit.label.trim())errors.push('Invalid kit label/ID/version')
 if(!safeString(kit.categoryId))errors.push('Invalid kit category')
 if(!Array.isArray(kit.items)||kit.items.length>1000)errors.push('Invalid kit items')
 else for(const item of kit.items as KitItem[])if(!item||!['preset','kit'].includes(item.kind)||!safeString(item.refId)||!item.refId||!integer(item.quantity,1))errors.push('Invalid kit reference')
 return errors
}
export async function listKits(){await initializeStorage();return db.kits.orderBy('label').toArray()}
export async function saveKit(kit:BuildKit){
 await initializeStorage();const errors=validateKit(kit);if(errors.length)throw new StorageError(errors.join('; '))
 await db.transaction('rw',db.kits,db.presets,db.presetCategories,db.revisions,async()=>{
  if(!await db.presetCategories.get(kit.categoryId))throw Error('Category not found')
  for(const item of kit.items){if(item.kind==='preset'?!await db.presets.get(item.refId):!await db.kits.get(item.refId))throw Error('Kit references missing '+item.kind+' '+item.refId)}
  const old=await db.kits.get(kit.id)
  await db.kits.put({...kit,updatedAt:now()})
  await db.revisions.add(logRevision('kit',kit.id,old?'update':'create',kit))
 })
}
export async function deleteKit(id:string){
 await initializeStorage();await db.transaction('rw',db.kits,db.revisions,async()=>{const old=await db.kits.get(id);if(!old)return;await db.kits.delete(id);await db.revisions.add(logRevision('kit',id,'delete',old))})
}
export async function listMaterials():Promise<LibraryMaterial[]>{await initializeStorage();return db.materials.toArray()}
export async function saveLibraryMaterial(material:LibraryMaterial):Promise<void>{
 await initializeStorage()
 if(!safeString(material.libraryId)||!material.libraryId||!safeString(material.name)||!integer(material.thickness,1))throw new StorageError('Invalid library material')
 await db.transaction('rw',db.materials,db.revisions,async()=>{
  const old=await db.materials.get(material.libraryId)
  const saved={...material,updatedAt:now()}
  await db.materials.put(saved)
  await db.revisions.add(logRevision('material',saved.libraryId,old?'update':'create',saved))
 })
}
export async function listRevisions(type?:RevisionEntity,id?:string):Promise<LibraryRevision[]>{
 await initializeStorage()
 if(type&&id)return (await db.revisions.where('[entityType+entityId]').equals([type,id]).toArray()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
 return db.revisions.orderBy('createdAt').reverse().toArray()
}
export async function ensureDefaultCategory(){await initializeStorage();if(!await db.presetCategories.get(UNCATEGORIZED_ID))await db.presetCategories.put(defaultCategory())}
export type {Material}
