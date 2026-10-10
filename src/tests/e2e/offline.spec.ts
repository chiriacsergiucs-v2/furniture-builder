import {test,expect} from '@playwright/test'

test('cached PWA edits and optimizes without a network connection',async({page,context})=>{
 await page.goto('')
 await page.evaluate(async()=>{
  if(!('serviceWorker' in navigator))throw Error('Service worker unsupported')
  await navigator.serviceWorker.ready
 })
 // The first navigation can happen before the service worker takes control.
 await page.reload()
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker?.controller))
 await context.setOffline(true)
 await page.reload()
 await expect(page.getByRole('button',{name:'+ New project'})).toBeVisible()
 await page.getByRole('button',{name:'+ New project'}).click()
 await page.getByRole('button',{name:'+ Add part'}).click()
 await page.getByRole('button',{name:'Optimize cutlist'}).click()
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible()
})
