// Compatibility facade: exported project API stays stable but stores data in Dexie.
// Do not write or delete legacy localStorage keys during migration or normal use.
export {
 StorageError,listProjects,getProject,saveProject,removeProject,duplicateProject,
 backupProject,restoreProject
} from '../db/repository.ts'
export type {OptimizationResult} from '../engine/types.ts'
