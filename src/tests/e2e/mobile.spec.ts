import {test,expect} from '@playwright/test'
test('create and edit from mobile viewport',async({page})=>{
 await page.goto('');await page.getByRole('button',{name:'+ New project'}).click();
 await expect(page.getByRole('heading',{name:'Cutlist editor'})).toBeVisible();
 await page.getByRole('button',{name:'+ Add part'}).click();
 await expect(page.getByText('New part',{exact:false}).first()).toBeVisible();
 await page.getByRole('button',{name:'Optimize cutlist'}).click();
 await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible();
 await expect(page.getByText('Stock sheets',{exact:true}).first()).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Optimization results'})).toBeVisible()
})
