import {test,expect} from '@playwright/test'

test('create, optimize, persist and reload on desktop and Android viewports',async({page})=>{
 await page.goto('')
 await page.getByRole('button',{name:'+ New project'}).click()
 await expect(page.getByRole('heading',{name:'Cutlist editor'})).toBeVisible()
 await page.getByRole('button',{name:'+ Add part'}).click()
 await expect(page.locator('.part-card').first().getByRole('textbox',{name:'Name'})).toHaveValue('New part')
 await page.getByRole('button',{name:'Optimize cutlist'}).click()
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible({timeout:15000}).catch(async error=>{
  console.log('OPTIMIZATION_DIAGNOSTICS',JSON.stringify({hash:await page.evaluate(()=>location.hash),alerts:await page.getByRole('alert').allTextContents(),main:(await page.locator('main').innerText()).slice(0,1400)}))
  throw error
 })
 await expect(page.getByText('Stock sheets',{exact:true}).first()).toBeVisible()
 await expect.poll(async()=>page.evaluate(async()=>{
  const r=indexedDB.open('mobila-cutlist-build-kit')
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})
  const tx=database.transaction('projects','readonly'),request=tx.objectStore('projects').getAll()
  const projects=await new Promise<Array<{lastResult?:unknown}>>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})
  database.close();return projects.some(p=>Boolean(p.lastResult))
 })).toBe(true)
 await page.reload()
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible()
})
