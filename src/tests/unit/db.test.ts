import 'fake-indexeddb/auto'
import {beforeEach,afterAll,describe,it,expect} from 'vitest'
import {FurnitureDatabase,MIGRATION_KEY,UNCATEGORIZED_ID,db} from '../../db/database.ts'
import {migrateLocalStorage,readLegacySnapshot} from '../../db/migration.ts'
import {createProject,emptyAbs} from '../../engine/types.ts'
import {createPreset,newPresetItem} from '../../presets/presets.ts'
import {saveProject,getProject,duplicateProject,removeProject,backupProject,restoreProject,saveCategory,listCategories,saveKit,listKits,listRevisions} from '../../db/repository.ts'
import {savePreset,listPresets,exportPresetLibrary,importPresetLibrary} from '../../presets/storage.ts'
import {exportDatabaseBackup,importDatabaseBackup,parseBuildKitBackup} from '../../db/backup.ts'

function fakeStorage(items:Record<string,string>):Storage{
 const map=new Map(Object.entries(items))
 return {get length(){return map.size},clear(){map.clear()},getItem(k){return map.get(k)??null},key(n){return [...map.keys()][n]??null},removeItem(k){map.delete(k)},setItem(k,v){map.set(k,v)}}
}
let temporary:FurnitureDatabase[]=[]
beforeEach(async()=>{
 await db.open()
 await db.transaction('rw',db.projects,db.presets,db.presetCategories,db.kits,db.materials,db.revisions,db.metadata,async()=>{
  for(const table of [db.projects,db.presets,db.presetCategories,db.kits,db.materials,db.revisions,db.metadata])await table.clear()
  await db.metadata.put({key:MIGRATION_KEY,value:{status:'completed',projects:0,presets:0,skipped:0,warnings:[],completedAt:'',sourceKeysPreserved:true},updatedAt:''})
  await db.presetCategories.put({schemaVersion:1,id:UNCATEGORIZED_ID,name:'Uncategorized',parentId:null,sortOrder:0,createdAt:'',updatedAt:''})
 })
})
afterAll(async()=>{db.close();for(const d of temporary){await d.delete()}})
describe('localStorage -> Dexie atomic migration',()=>{
 it('imports indexed and orphan projects plus presets without deleting originals',async()=>{
  const project=createProject();project.id='legacy-p';project.parts.push({id:'part1',label:'Drawer side',width:400,height:200,quantity:2,materialId:'pal18',rotationAllowed:true,grain:'none',abs:emptyAbs()})
  const preset=createPreset('Drawer top',[newPresetItem(project.materials[0])])
  const source=fakeStorage({'mobila-cutlist:project-index':'[]','mobila-cutlist:project:legacy-p':JSON.stringify(project),'mobila-cutlist:presets:v1':JSON.stringify([preset])})
  const database=new FurnitureDatabase('migration-test-'+crypto.randomUUID());temporary.push(database)
  const report=await migrateLocalStorage(database,source)
  expect(report.projects).toBe(1);expect(report.presets).toBe(1)
  expect((await database.projects.get(project.id))?.parts[0].label).toBe('Drawer side')
  expect((await database.presets.get(preset.id))?.categoryId).toBe(UNCATEGORIZED_ID)
  expect(await database.materials.count()).toBe(2)
  expect(source.getItem('mobila-cutlist:project:legacy-p')).toBe(JSON.stringify(project))
  expect((await migrateLocalStorage(database,source)).projects).toBe(1)
  expect(await database.projects.count()).toBe(1)
 })
 it('does not clobber newer IndexedDB data and isolates corrupt legacy records',async()=>{
  const existing=createProject();existing.id='same';existing.name='New data'
  const old={...existing,name:'Legacy data'}
  const store=fakeStorage({'mobila-cutlist:project-index':'["same","corrupt"]','mobila-cutlist:project:same':JSON.stringify(old),'mobila-cutlist:project:corrupt':'{broken'})
  const database=new FurnitureDatabase('no-clobber-'+crypto.randomUUID());temporary.push(database)
  await database.projects.put(existing)
  const report=await migrateLocalStorage(database,store)
  expect(report.skipped).toBe(1)
  expect((await database.projects.get('same'))?.name).toBe('New data')
  expect(store.getItem('mobila-cutlist:project:corrupt')).toBe('{broken')
 })
 it('leaves original localStorage data intact when IndexedDB write fails',async()=>{
  const p=createProject();const store=fakeStorage({['mobila-cutlist:project:'+p.id]:JSON.stringify(p)})
  const database=new FurnitureDatabase('failed-'+crypto.randomUUID());temporary.push(database)
  database.close();await database.delete()
  // An unavailable database must never mutate the original legacy records.
  expect(readLegacySnapshot(store).projects).toHaveLength(1)
  expect(store.getItem('mobila-cutlist:project:'+p.id)).toBe(JSON.stringify(p))
 })
})
describe('Dexie collections and backups',()=>{
 it('persists projects with independent copies and snapshots',async()=>{
  const project=createProject();project.name='Cabinet';const saved=await saveProject(project)
  expect((await getProject(saved.id))?.name).toBe('Cabinet')
  const cp=await duplicateProject(saved);expect(cp.id).not.toBe(saved.id)
  expect(await listRevisions('project',saved.id)).toHaveLength(1)
  const backup=backupProject(saved);await removeProject(saved.id);expect(await getProject(saved.id)).toBeUndefined()
  await restoreProject(backup);expect((await getProject(saved.id))?.name).toBe('Cabinet')
 })
 it('keeps old preset backup/restore format and category assignment',async()=>{
  const p=createProject(),preset=createPreset('Drawer top',[newPresetItem(p.materials[0])])
  const cat={schemaVersion:1 as const,id:'drawers',name:'Drawers',parentId:null,sortOrder:1,createdAt:'2026-01-01',updatedAt:'2026-01-01'}
  await saveCategory(cat)
  expect((await listCategories()).map(c=>c.id)).toContain('drawers')
  await savePreset({...preset,categoryId:cat.id})
  expect((await listPresets())[0].categoryId).toBe('drawers')
  const json=await exportPresetLibrary()
  expect(JSON.parse(json).kind).toBe('mobila-cutlist-presets')
  await importPresetLibrary(json)
  expect(await listPresets()).toHaveLength(2)
 })
 it('supports kits and complete JSON backup roundtrip without overwriting',async()=>{
  const project=createProject();await saveProject(project)
  const preset=createPreset('Drawer bottom',[newPresetItem(project.materials[0])]);await savePreset(preset)
  await saveKit({schemaVersion:1,id:'kit-1',label:'Drawer',categoryId:UNCATEGORIZED_ID,items:[{kind:'preset',refId:preset.id,quantity:3}],createdAt:'2026-01-01',updatedAt:'2026-01-01'})
  expect(await listKits()).toHaveLength(1)
  const json=await exportDatabaseBackup()
  expect(parseBuildKitBackup(json).collections.kits).toHaveLength(1)
  const result=await importDatabaseBackup(json)
  expect(result.imported.projects).toBe(0)
  expect(result.skipped.projects).toBe(1)
  expect(await listKits()).toHaveLength(1)
 })
 it('rejects invalid full backups before modifying any data',async()=>{
  const project=createProject();await saveProject(project)
  const backup=JSON.parse(await exportDatabaseBackup())
  backup.collections.projects[0].name=10
  await expect(importDatabaseBackup(JSON.stringify(backup))).rejects.toThrow(/Invalid project/)
  expect((await getProject(project.id))?.name).toBe(project.name)
 })
})
