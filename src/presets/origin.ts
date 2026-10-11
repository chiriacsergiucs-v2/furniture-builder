import type {CutlistPreset} from './presets.ts'
/** Immutable reference to a saved preset revision. Missing on legacy/manual parts. */
export interface PresetOrigin {
 id:string
 revision:number
 definitionId?:string
 definitionVersion?:number
 templateId?:string
 templateVersion?:number
}
export function presetOrigin(preset:CutlistPreset):PresetOrigin{
 return {id:preset.id,revision:preset.revision??1,
  ...(preset.componentTree?{definitionId:preset.componentTree.definitionId,definitionVersion:preset.componentTree.definitionVersion}:{}),
  ...(preset.componentTree?.template?{templateId:preset.componentTree.template.id,templateVersion:preset.componentTree.template.version}:{}),
  ...(!preset.componentTree?.template&&preset.cabinetSpec?.templateId?{
   templateId:preset.cabinetSpec.templateId,templateVersion:preset.cabinetSpec.templateVersion??1
  }:{})
 }
}
export function validPresetOrigin(value:unknown):value is PresetOrigin{
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const x=value as Partial<PresetOrigin>
 return typeof x.id==='string'&&x.id.length>0&&x.id.length<=20000&&
  Number.isSafeInteger(x.revision)&&(x.revision as number)>=1&&
  (x.definitionId===undefined||(typeof x.definitionId==='string'&&x.definitionId.length>0))&&
  (x.definitionVersion===undefined||(Number.isSafeInteger(x.definitionVersion)&&x.definitionVersion>=1))&&
  (x.templateId===undefined||(typeof x.templateId==='string'&&x.templateId.length>0))&&
  (x.templateVersion===undefined||(Number.isSafeInteger(x.templateVersion)&&x.templateVersion>=1))&&
  (x.definitionVersion===undefined||x.definitionId!==undefined)&&
  (x.templateVersion===undefined||x.templateId!==undefined)
}
