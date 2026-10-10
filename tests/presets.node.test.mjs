import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createProject,emptyAbs} from '../src/engine/types.ts'
import {createPreset,newPresetItem,presetFromParts,validatePreset,instantiatePreset} from '../src/presets/presets.ts'
import {deletePreset,exportPresetLibrary,importPresetLibrary,listPresets,savePreset} from '../src/presets/storage.ts'

function sample(){const p=createProject();const a=newPresetItem(p.materials[0]);a.label='Top panel';a.width=450;a.height=210;a.quantity=2;a.abs.top='ABS 2 mm';const b={...newPresetItem(p.materials[0]),label:'Side panel',width:210,height:120,quantity:1};return {p,preset:createPreset('Drawer top',[a,b])}}

test('preset captures independent labeled cut items and preserves ABS/constraints',()=>{
 const {p,preset}=sample();assert.deepEqual(validatePreset(preset),[])
 const inserted=instantiatePreset(preset,p,3)
 assert.equal(inserted.length,2);assert.deepEqual(inserted.map(x=>x.quantity),[6,3]);assert.equal(inserted[0].label,'Top panel');assert.equal(inserted[0].abs.top,'ABS 2 mm');assert.equal(inserted[0].group,'Drawer top')
 assert.notEqual(inserted[0].id,inserted[1].id);assert.notEqual(instantiatePreset(preset,p)[0].id,inserted[0].id)
 inserted[0].abs.top='changed';assert.equal(preset.items[0].abs.top,'ABS 2 mm')
})
test('preset rejects fractional sizes, zero quantity, empty label, invalid material',()=>{
 const {preset}=sample();preset.items[0].width=1.5;assert.notDeepEqual(validatePreset(preset),[])
 preset.items[0].width=3;preset.items[0].quantity=0;assert.notDeepEqual(validatePreset(preset),[])
 preset.items[0].quantity=1;preset.label=' ';assert.notDeepEqual(validatePreset(preset),[])
 preset.label='Drawer top';preset.items[0].material.thickness=19;assert.notDeepEqual(validatePreset({...preset,items:[{...preset.items[0],material:{...preset.items[0].material,thickness:-1}}]}),[])
})
test('material resolution refuses missing, ambiguous, and different-thickness materials; insertion is atomic',()=>{
 const {p,preset}=sample();p.materials[0].thickness=16
 assert.throws(()=>instantiatePreset(preset,p),/Required material not found/)
 p.materials[0].thickness=18;p.materials.push({...p.materials[0],id:'duplicate'})
 assert.throws(()=>instantiatePreset(preset,p),/Ambiguous material/)
 p.materials.pop();preset.items[1].material.thickness=19
 assert.throws(()=>instantiatePreset(preset,p),/Required material not found/)
 assert.equal(p.parts.length,0)
})
test('save, edit, reopen, backup, import and delete presets in IndexedDB',async()=>{
 const {p,preset}=sample()
 assert.equal((await listPresets()).length,0)
 await savePreset(preset);assert.equal((await listPresets()).length,1)
 preset.label='Drawer top revised';await savePreset(preset)
 assert.equal((await listPresets())[0].label,'Drawer top revised')
 const exported=await exportPresetLibrary();const imported=await importPresetLibrary(exported)
 assert.equal(imported.length,2);assert.notEqual(imported[0].id,imported[1].id)
 const restored=instantiatePreset((await listPresets())[0],p)
 assert.equal(restored[0].width,450)
 assert.equal((await deletePreset(imported[0].id)).length,1)
})
test('invalid preset backup format cannot destroy library data',async()=>{
 const {preset}=sample();await savePreset(preset)
 await assert.rejects(()=>importPresetLibrary('{"schemaVersion":1,"kind":"incorrect","presets":[]}'),/Unsupported/)
 assert.equal((await listPresets()).length,1)
})
test('create preset from existing project parts retains materials and names',()=>{
 const p=createProject();p.parts.push({id:'original',label:'Drawer bottom',width:310,height:260,quantity:2,materialId:'pal18',rotationAllowed:false,grain:'x',abs:emptyAbs()})
 const preset=presetFromParts(p);preset.label='Drawer';assert.equal(preset.items[0].label,'Drawer bottom');assert.equal(preset.items[0].grain,'x');assert.equal(preset.items[0].material.thickness,18)
 const inserted=instantiatePreset(preset,p);assert.equal(inserted[0].label,'Drawer bottom');assert.notEqual(inserted[0].id,'original')
})
