import {test,expect} from '@playwright/test'

test('cutlist order persists without an invented assembled 3D model',async({page})=>{
 await page.goto('')
 await page.getByRole('button',{name:'+ New project'}).click()
 await page.getByRole('button',{name:'+ Add part'}).click()
 await page.getByRole('button',{name:'+ Add part'}).click()
 const names=page.locator('.parts-list .part-card').getByRole('textbox',{name:'Name'})
 await names.nth(0).fill('Left side')
 await names.nth(1).fill('Right side')
 await page.getByText('Reorder cutlist parts · drag, keyboard or arrows').click()
 await page.getByRole('button',{name:'Move Right side up'}).click()
 await expect(page.locator('.parts-list .part-card').first().getByRole('textbox',{name:'Name'})).toHaveValue('Right side')
 await page.getByRole('button',{name:'View assembled 3D'}).click()
 await expect(page.getByText('No assembled furniture model yet.',{exact:false})).toBeVisible()
 await expect.poll(async()=>page.evaluate(async()=>{
  const request=indexedDB.open('mobila-cutlist-build-kit')
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  try{
   const read=database.transaction('projects','readonly').objectStore('projects').getAll()
   const items=await new Promise<Array<{parts:Array<{label:string}>}>>((resolve,reject)=>{read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error)})
   return items[0]?.parts[0]?.label??null
  }finally{database.close()}
 })).toBe('Right side')
 await page.reload()
 await expect(page.getByRole('heading',{name:'Cutlist editor'})).toBeVisible()
 await expect(page.locator('.parts-list .part-card').first().getByRole('textbox',{name:'Name'})).toHaveValue('Right side')
})
