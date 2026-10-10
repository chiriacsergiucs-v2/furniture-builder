import Dexie, {type Table} from 'dexie'
import type {Material,Project} from '../engine/types.ts'
import type {CutlistPreset} from '../presets/presets.ts'

export const DATABASE_NAME='mobila-cutlist-build-kit'
export const DATABASE_SCHEMA_VERSION=2
export const UNCATEGORIZED_ID='uncategorized'
export const MIGRATION_KEY='migration:localStorage:v1'

export interface PresetCategory {
 schemaVersion:1; id:string; name:string; parentId:string|null; sortOrder:number
 createdAt:string; updatedAt:string
}
export interface StoredPreset extends CutlistPreset {categoryId:string}
export interface KitItem {kind:'preset'|'kit'; refId:string; quantity:number; revisionId?:string}
export interface BuildKit {
 schemaVersion:1; id:string; label:string; categoryId:string; items:KitItem[]
 description?:string; createdAt:string; updatedAt:string
}
export interface LibraryMaterial extends Material {
 schemaVersion:1; libraryId:string; sourceProjectId?:string; updatedAt:string
}
export type RevisionEntity='project'|'preset'|'category'|'kit'|'material'
export interface LibraryRevision {
 schemaVersion:1; id:string; entityType:RevisionEntity; entityId:string
 action:'create'|'update'|'delete'|'import'; createdAt:string; snapshot:unknown
}
export interface Metadata {key:string; value:unknown; updatedAt:string}
export interface MigrationReport {
 status:'completed'; projects:number; presets:number; skipped:number; warnings:string[]
 completedAt:string; sourceKeysPreserved:true
}

export class FurnitureDatabase extends Dexie {
 projects!:Table<Project,string>
 presetCategories!:Table<PresetCategory,string>
 presets!:Table<StoredPreset,string>
 kits!:Table<BuildKit,string>
 materials!:Table<LibraryMaterial,string>
 revisions!:Table<LibraryRevision,string>
 metadata!:Table<Metadata,string>
 constructor(name=DATABASE_NAME){
  super(name)
  // Retain old schema declarations. Future changes must increment Dexie's version.
  this.version(1).stores({
   projects:'id,updatedAt,name',presetCategories:'id,name,parentId',
   presets:'id,label,updatedAt',kits:'id,label,updatedAt',
   materials:'libraryId,type,thickness',revisions:'id,[entityType+entityId],createdAt',metadata:'key'
  })
  this.version(2).stores({
   projects:'id,updatedAt,name',presetCategories:'id,name,parentId,sortOrder',
   presets:'id,categoryId,label,updatedAt',kits:'id,categoryId,label,updatedAt',
   materials:'libraryId,type,thickness,name,sourceProjectId',
   revisions:'id,[entityType+entityId],createdAt',metadata:'key'
  }).upgrade(async tx=>{
   await tx.table('presets').toCollection().modify(p=>{if(!p.categoryId)p.categoryId=UNCATEGORIZED_ID})
   await tx.table('kits').toCollection().modify(k=>{if(!k.categoryId)k.categoryId=UNCATEGORIZED_ID})
  })
 }
}
export const db=new FurnitureDatabase()
export const now=()=>new Date().toISOString()
export function defaultCategory():PresetCategory{
 const timestamp=now()
 return {schemaVersion:1,id:UNCATEGORIZED_ID,name:'Uncategorized',parentId:null,sortOrder:0,createdAt:timestamp,updatedAt:timestamp}
}
