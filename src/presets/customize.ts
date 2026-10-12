import type {Project} from '../engine/types.ts'
import type {StoredPreset} from '../db/database.ts'
import type {CutlistPreset} from './presets.ts'
import {instantiatePreset,validatePreset} from './presets.ts'

/** An in-memory customization is never a new library preset or database write.
 * Source ID and revision remain pinned; each generated project part receives fresh IDs.
 */
export function instantiateCustomizedPreset(
 source:StoredPreset,draft:CutlistPreset,target:Project,copies=1
){
 if(source.id!==draft.id)throw Error('Customization must retain its source preset ID.')
 if(source.cabinetSpec&&!draft.cabinetSpec||
    source.drawerSpec&&!draft.drawerSpec||
    !source.cabinetSpec&&!source.drawerSpec&&(draft.cabinetSpec!==undefined||draft.drawerSpec!==undefined))
  throw Error('Customization must retain its component kind.')
 const snapshot:CutlistPreset={...structuredClone(draft),id:source.id,
  revision:source.revision??1,createdAt:source.createdAt}
 const issues=validatePreset(snapshot)
 if(issues.length)throw Error(issues.join('; '))
 return instantiatePreset(snapshot,target,copies)
}

/** When regenerating parametric geometry, preserve source revision without
 * pretending the library was edited or duplicating its record. */
export function customizeGeneratedPreset(source:StoredPreset,generated:CutlistPreset):CutlistPreset{
 if(Boolean(source.cabinetSpec)!==Boolean(generated.cabinetSpec)||
    Boolean(source.drawerSpec)!==Boolean(generated.drawerSpec))
  throw Error('A customized component cannot silently switch its generator kind.')
 return {...generated,id:source.id,revision:source.revision??1,createdAt:source.createdAt}
}
