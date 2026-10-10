import {test,expect} from '@playwright/test'

test('create, optimize, persist and reload on desktop and Android viewports',async({page})=>{
 await page.goto('')
 await page.getByRole('button',{name:'+ New project'}).click()
 await expect(page.getByRole('heading',{name:'Cutlist editor'})).toBeVisible()
 await page.getByRole('button',{name:'+ Add part'}).click()
 await expect(page.locator('.part-card').first().getByRole('textbox',{name:'Name'})).toHaveValue('New part')
 await page.getByRole('button',{name:'Optimize cutlist'}).click()
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible()
 await expect(page.getByText('Stock sheets',{exact:true}).first()).toBeVisible()
 await expect.poll(async()=>page.evaluate(()=>Object.keys(localStorage).some(key=>{
  if(!key.startsWith('mobila-cutlist:project:'))return false
  try{return Boolean(JSON.parse(localStorage.getItem(key)??'null')?.lastResult)}catch{return false}
 }))).toBe(true)
 await page.reload()
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible()
})
