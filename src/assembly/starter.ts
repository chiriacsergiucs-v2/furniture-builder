import {db,now} from '../db/database.ts'
import {DRAWER_CATEGORY_ID,DRAWER_PRESET_ID,DRAWER_KIT_ID} from './model.ts'
import type {PresetItem} from '../presets/presets.ts'
const MARKER='starter:drawer-40x30:v1'
const material={name:'PAL 18 mm',type:'PAL' as const,thickness:18}
const item=(label:string,width:number,height:number,quantity:number):PresetItem=>({
 label,width,height,quantity,material,rotationAllowed:true,grain:'none',
 abs:{top:null,right:null,bottom:null,left:null}
})
export async function ensureDrawerStarter():Promise<void>{
 await db.transaction('rw',[db.presetCategories,db.presets,db.kits,db.metadata],async()=>{
  if(await db.metadata.get(MARKER))return
  const date=now()
  if(!await db.presetCategories.get(DRAWER_CATEGORY_ID))await db.presetCategories.put({
   schemaVersion:1,id:DRAWER_CATEGORY_ID,name:'Drawers',parentId:null,sortOrder:1,createdAt:date,updatedAt:date
  })
  if(!await db.presets.get(DRAWER_PRESET_ID))await db.presets.put({
   schemaVersion:1,id:DRAWER_PRESET_ID,label:'40 × 30 cm Drawer',categoryId:DRAWER_CATEGORY_ID,
   items:[item('Drawer side',300,250,2),item('Drawer back',300,250,1),
    item('Drawer front (inner)',300,250,1),item('Front Main',400,300,1)],
   createdAt:date,updatedAt:date
  })
  if(!await db.kits.get(DRAWER_KIT_ID))await db.kits.put({
   schemaVersion:1,id:DRAWER_KIT_ID,label:'40 × 30 cm Drawer',
   categoryId:DRAWER_CATEGORY_ID,description:'Assembly example: 5 positioned panels, four cutlist rows; no bottom or hardware.',
   items:[{kind:'preset',refId:DRAWER_PRESET_ID,quantity:1}],
   createdAt:date,updatedAt:date
  })
  await db.metadata.put({key:MARKER,value:true,updatedAt:date})
 })
}
