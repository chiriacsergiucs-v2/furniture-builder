import type {Project,OptimizationResult} from '../engine/types.ts'
import {validateProject} from '../engine/schema.ts'
import {validateResult} from '../engine/validate.ts'
const prefix='mobila-cutlist:'
const projectKey=(id:string)=>`${prefix}project:${id}`
const indexKey=`${prefix}project-index`
const versionKey=`${prefix}schema-version`
export class StorageError extends Error{constructor(msg:string){super(msg);this.name='StorageError'}}
function getStore():Storage{try{const s=window.localStorage;const probe=`${prefix}probe`;s.setItem(probe,'1');s.removeItem(probe);return s}catch{throw new StorageError('Browser storage is disabled or unavailable. Export a JSON backup before closing.')}}
function readIndex():string[]{try{const raw=getStore().getItem(indexKey);if(!raw)return [];const x:unknown=JSON.parse(raw);return Array.isArray(x)?x.filter((v):v is string=>typeof v==='string'):[]}catch{return []}}
export function listProjects():Project[]{const store=getStore();const found:Project[]=[];for(const id of readIndex()){const raw=store.getItem(projectKey(id));if(!raw)continue;try{const value:unknown=JSON.parse(raw);if(validateProject(value).length===0){const p=value as Project;if(p.lastResult){try{if(validateResult(p,p.lastResult).length)p.lastResult=undefined}catch{p.lastResult=undefined}}found.push(p)}}catch{/* corrupted project is isolated */}}return found.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
export function getProject(id:string):Project|undefined{return listProjects().find(p=>p.id===id)}
export function saveProject(project:Project){const issues=validateProject(project);if(issues.length)throw new StorageError(`Cannot save invalid project: ${issues.join('; ')}`)
 const data:Project={...project,updatedAt:new Date().toISOString()};if(data.lastResult){try{if(validateResult(data,data.lastResult).length)data.lastResult=undefined}catch{data.lastResult=undefined}}
 const store=getStore();try{store.setItem(projectKey(data.id),JSON.stringify(data));const ids=readIndex();if(!ids.includes(data.id))ids.push(data.id);store.setItem(indexKey,JSON.stringify(ids));store.setItem(versionKey,'1')}catch(error){throw new StorageError(error instanceof DOMException&&error.name==='QuotaExceededError'?'Storage capacity reached. Export JSON and remove unused projects.':'Could not write browser data. Export a JSON backup.')}
 return data
}
export function removeProject(id:string){const s=getStore();s.removeItem(projectKey(id));s.setItem(indexKey,JSON.stringify(readIndex().filter(x=>x!==id)))}
export function duplicateProject(p:Project){const copy:Project={...structuredClone(p),id:crypto.randomUUID(),name:`${p.name} (copy)`,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),lastResult:undefined};return saveProject(copy)}
export function backupProject(p:Project):string{const issues=validateProject(p);if(issues.length)throw new StorageError(issues.join('; '));return JSON.stringify({...p,lastResult:undefined},null,2)}
export function restoreProject(json:string,overwrite=false):Project{let value:unknown;try{value=JSON.parse(json)}catch{throw new StorageError('Invalid JSON backup')}const issues=validateProject(value);if(issues.length)throw new StorageError(`Backup invalid: ${issues.join('; ')}`);const p=value as Project;if(getProject(p.id)&&!overwrite)throw new StorageError('Project ID already exists. Confirm overwrite or duplicate the backup.');return saveProject({...p,lastResult:undefined})}
export type {OptimizationResult}
