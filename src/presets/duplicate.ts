import type {CutlistPreset} from './presets.ts'
export function duplicatePresetDraft(source:CutlistPreset,uuid:()=>string=()=>crypto.randomUUID(),time:()=>string=()=>new Date().toISOString()):CutlistPreset{
 const date=time()
 return {...structuredClone(source),id:uuid(),revision:1,label:source.label+' (copy)',createdAt:date,updatedAt:date}
}
