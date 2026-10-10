import {test,expect} from '@playwright/test'
import {createProject} from '../../engine/types.ts'
import {createPreset,newPresetItem} from '../../presets/presets.ts'

test('legacy projects and presets migrate without localStorage deletion',async({page})=>{
 const project=createProject();project.id='legacy-browser';project.name='Legacy cabinet'
 const preset=createPreset('Drawer top',[newPresetItem(project.materials[0])]);preset.id='legacy-preset'
 await page.addInitScript(({p,presetJson})=>{
  localStorage.setItem('mobila-cutlist:project-index',JSON.stringify([p.id]))
  localStorage.setItem('mobila-cutlist:project:'+p.id,JSON.stringify(p))
  localStorage.setItem('mobila-cutlist:presets:v1',presetJson)
 },{p:project,presetJson:JSON.stringify([preset])})
 await page.goto('')
 await expect(page.getByText('Legacy cabinet')).toBeVisible()
 await page.getByRole('button',{name:'Open'}).click()
 const presets=page.getByRole('region',{name:'Presets'})
 await expect(presets.getByText('Drawer top',{exact:true})).toBeVisible()
 expect(await page.evaluate(()=>localStorage.getItem('mobila-cutlist:project:legacy-browser'))).toBe(JSON.stringify(project))
 await page.reload()
 await expect(presets.getByText('Drawer top',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Settings'}).click()
 await expect(page.getByText('Migration: 1 legacy projects and 1 presets copied.')).toBeVisible()
})
