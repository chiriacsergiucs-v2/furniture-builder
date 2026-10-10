import type {Material,MaterialType,Part,Project,GrainAxis,EdgeBanding} from '../engine/types.ts'
import {emptyAbs} from '../engine/types.ts'
import {integer,safeString} from '../engine/schema.ts'

export interface PresetMaterial {name:string; type:MaterialType; thickness:number; finish?:string}
export interface PresetItem {
 label:string; width:number; height:number; quantity:number
 material:PresetMaterial; rotationAllowed:boolean; grain:GrainAxis; abs:EdgeBanding
 notes?:string
}
export interface CutlistPreset {
 schemaVersion:1; id:string; label:string; items:PresetItem[]
 createdAt:string; updatedAt:string
}
const sides=['top','right','bottom','left'] as const
const typeNames=['PAL','MDF','plywood','custom']
const axes=['none','x','y']
export const presetMaterial=(m:Material):PresetMaterial=>({name:m.name,type:m.type,thickness:m.thickness,...(m.finish!==undefined?{finish:m.finish}:{})})
export function newPresetItem(material:Material):PresetItem{return {label:'New item',width:500,height:300,quantity:1,material:presetMaterial(material),rotationAllowed:true,grain:'none',abs:emptyAbs()}}
export function createPreset(label:string,items:PresetItem[]):CutlistPreset{const timestamp=new Date().toISOString();return {schemaVersion:1,id:crypto.randomUUID(),label,items:structuredClone(items),createdAt:timestamp,updatedAt:timestamp}}
export function presetFromParts(project:Project):CutlistPreset{
 const materials=new Map(project.materials.map(m=>[m.id,m]))
 const items=project.parts.map(part=>{
  const material=materials.get(part.materialId)
  if(!material)throw Error('Material missing for part '+part.label)
  return {label:part.label,width:part.width,height:part.height,quantity:part.quantity,material:presetMaterial(material),rotationAllowed:part.rotationAllowed,grain:part.grain,abs:structuredClone(part.abs),...(part.notes!==undefined?{notes:part.notes}:{})}
 })
 return createPreset('',items)
}
export function validatePreset(value:unknown):string[]{
 if(!value||typeof value!=='object'||Array.isArray(value))return ['Preset must be an object']
 const p=value as Partial<CutlistPreset>
 const errors:string[]=[]
 if(p.schemaVersion!==1)errors.push('Unsupported preset schema version')
 if(!safeString(p.id)||!p.id)errors.push('Preset ID required')
 if(!safeString(p.label)||!p.label.trim())errors.push('Preset label required')
 if(!safeString(p.createdAt)||!Number.isFinite(Date.parse(p.createdAt)))errors.push('Invalid created timestamp')
 if(!safeString(p.updatedAt)||!Number.isFinite(Date.parse(p.updatedAt)))errors.push('Invalid updated timestamp')
 if(!Array.isArray(p.items)||p.items.length===0||p.items.length>1000)return [...errors,'Preset must contain 1–1000 items']
 p.items.forEach((item,index)=>{
  if(!item||!safeString(item.label)||!item.label.trim()||!integer(item.width,1)||!integer(item.height,1)||!integer(item.quantity,1)||typeof item.rotationAllowed!=='boolean'||!axes.includes(item.grain)||!item.abs||!sides.every(side=>item.abs[side]===null||safeString(item.abs[side]))||!item.material||!safeString(item.material.name)||!item.material.name.trim()||!typeNames.includes(item.material.type)||!integer(item.material.thickness,1)||(item.material.finish!==undefined&&!safeString(item.material.finish))||(item.notes!==undefined&&!safeString(item.notes))){errors.push('Invalid preset item '+(index+1))}
 })
 return errors
}
export function resolvePresetMaterial(required:PresetMaterial,materials:Material[]):Material{
 const candidates=materials.filter(m=>m.type===required.type&&m.thickness===required.thickness&&(m.finish??'').trim().toLowerCase()===(required.finish??'').trim().toLowerCase())
 const exact=candidates.filter(m=>m.name.trim().toLowerCase()===required.name.trim().toLowerCase())
 if(exact.length===1)return exact[0]
 if(exact.length>1||candidates.length>1)throw Error('Ambiguous material for '+required.name+' ('+required.type+' '+required.thickness+' mm). Rename or remove duplicate materials before inserting.')
 if(candidates.length===1)return candidates[0]
 throw Error('Required material not found: '+required.name+' ('+required.type+' '+required.thickness+' mm'+(required.finish?', '+required.finish:'')+'). Add a compatible material to this project first.')
}
export function instantiatePreset(preset:CutlistPreset,project:Project,copies=1):Part[]{
 const issues=validatePreset(preset)
 if(issues.length)throw Error(issues.join('; '))
 if(!integer(copies,1))throw Error('Preset copies must be a positive integer')
 return preset.items.map(item=>{
  const quantity=item.quantity*copies
  if(!Number.isSafeInteger(quantity))throw Error('Quantity overflow for '+item.label)
  const material=resolvePresetMaterial(item.material,project.materials)
  return {id:crypto.randomUUID(),label:item.label,width:item.width,height:item.height,quantity,materialId:material.id,rotationAllowed:item.rotationAllowed,grain:item.grain,abs:structuredClone(item.abs),group:preset.label,...(item.notes!==undefined?{notes:item.notes}:{})}
 })
}
