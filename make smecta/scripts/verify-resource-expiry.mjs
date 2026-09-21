import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/djouadimounsaf/.cache/ms-playwright-go/1.57.0/package/index.mjs');
const origin = process.env.RESOURCES_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
await mkdir('artifacts/resource-expiry',{recursive:true});
const translations = Object.fromEntries(['en','fr','ar'].map(locale => [locale,{title:`Live resource ${locale}`,description:`Resource description ${locale}`} ]));
const card = {id:'fixture',slug:'fixture',country:'Resource',categories:['Resources'],applyUrl:'https://example.org/register',imagePath:'/assets/resources/british-council.webp',deadline:'2099-12-31',opensAt:null,featured:true,published:true,translations};
try {
 const page=await browser.newPage({locale:'en-US',viewport:{width:1440,height:1000}});
 let mode='mixed';
 const fixedNow = Date.parse('2030-09-19T22:59:59Z');
 await page.route('**/api/v1/resources',route => {
  if (mode === 'hang') return;
  const expired={...card,id:'expired',deadline:'2000-01-01',translations:Object.fromEntries(['en','fr','ar'].map(locale=>[locale,{title:'Expired must not appear',description:'Expired'}]))};
  return route.fulfill({status:mode==='failure'?503:200,contentType:'application/json',body:JSON.stringify({now:mode==='live'?fixedNow:Date.now(),items:mode==='mixed'?[card,expired,{...card,id:'draft',published:false}]:mode==='live'?[{...card,deadline:'2030-09-19'}]:[expired]})});
 });
 for (const locale of ['en','fr','ar']) {
  const prefix=locale==='en'?'':`/${locale}`;
  mode='mixed'; await page.goto(`${origin}${prefix}/resources`);
  await page.waitForSelector('.resource-card');
  assert.equal(await page.locator('.resource-card').count(),1);
  assert.equal(await page.locator('.resource-register').getAttribute('href'),card.applyUrl);
  assert.match(await page.locator('.resource-card h2').innerText(),new RegExp(locale));
  mode='expired'; await page.reload(); await page.waitForSelector('.resources-empty');
  assert.equal(await page.locator('.resource-card').count(),0);
  assert.equal(await page.locator('.resources-journey').count(),0);
  assert.equal(await page.locator('.resources-empty a').nth(0).getAttribute('href'),`${prefix}/opportunities`);
  assert.equal(await page.locator('.resources-empty a').nth(1).getAttribute('href'),`${prefix}/guides`);
  for (const width of [1440,768,390]) {
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>document.fonts.ready);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.screenshot({path:`artifacts/resource-expiry/empty-${locale}-${width}.png`,fullPage:true});
  }
 }
 console.log('Expiry: localized empty layouts passed');
 mode='failure'; await page.reload(); await page.waitForSelector('.resources-empty');
 assert.equal(await page.locator('.resource-card').count(),0);
 await page.clock.install({time:new Date(fixedNow)});
 mode='hang'; await page.reload({waitUntil:'domcontentloaded'}); await page.waitForSelector('.resources-loading');
 console.log('Expiry: checking request timeout');
 await page.clock.runFor(10_100); await page.waitForSelector('.resources-empty');
 console.log('Expiry: request timeout passed');
 mode='live'; await page.clock.setSystemTime(new Date(fixedNow)); await page.reload(); await page.waitForSelector('.resource-card');
 await page.clock.runFor(1500); await page.waitForSelector('.resources-empty');
 console.log('Expiry: live midnight boundary passed');
 await page.close();

 // Real authenticated local API: publish, upload, expire, renew and delete a test-only card.
 const admin=await browser.newPage({locale:'en-US',viewport:{width:1440,height:1000}});
 const errors=[]; admin.on('pageerror',error=>errors.push(error.message));
 await admin.goto(`${origin}/admin`);
 await admin.locator('#admin-passkey').fill((await readFile(process.env.ASTEP_TEST_PASSKEY_FILE || '/home/djouadimounsaf/astep-local-admin-passkey.txt','utf8')).trim());
 await admin.locator('button[type=submit]').click();
 await admin.waitForURL('**/admin/dashboard');
 await admin.getByRole('button',{name:'Resources',exact:true}).first().click();
 await admin.getByRole('button',{name:'Add resource',exact:true}).click();
 const slug=`resource-browser-check-${Date.now()}`;
 let resourceId;
 try {
  await admin.locator('input[pattern]').fill(slug);
  await admin.locator('input[type=date]').fill('2000-01-01');
  await admin.locator('input[type=url]').fill('https://example.org/resource-check');
  for (const locale of ['en','fr','ar']) {
   await admin.getByRole('tab',{name:locale.toUpperCase(),exact:true}).click();
   await admin.locator(`#translation-title-${locale}`).fill(slug);
   await admin.locator(`#translation-description-${locale}`).fill(`Resource check ${locale}`);
  }
  await admin.locator('input[type=file]').setInputFiles('public/assets/resources/british-council.webp');
  const draftPromise=admin.waitForResponse(response=>response.url().endsWith('/api/v1/admin/resources')&&response.request().method()==='POST');
  await admin.getByRole('button',{name:'Upload',exact:true}).click();
  const draft=await draftPromise; assert.equal(draft.status(),201); resourceId=(await draft.json()).resourceId;
  await admin.getByRole('button',{name:'Upload replacement',exact:true}).waitFor();
  await admin.getByLabel('Published',{exact:true}).check();
  await admin.getByRole('button',{name:'Save',exact:true}).click();
  await admin.getByRole('button',{name:'Add resource',exact:true}).waitFor();
  const row=admin.locator('.card').filter({has:admin.getByRole('heading',{name:slug,exact:true})});
  await row.waitFor(); assert.match(await row.innerText(),/Expired/);
  let publicItems=await admin.evaluate(async()=> (await (await fetch('/api/v1/resources')).json()).items);
  assert.ok(!publicItems.some(item=>item.slug===slug));
  await row.getByRole('button',{name:'Edit',exact:true}).click();
  await admin.locator('input[type=date]').fill('2099-12-31');
  await admin.getByRole('button',{name:'Save',exact:true}).click();
  await admin.getByRole('button',{name:'Add resource',exact:true}).waitFor();
  publicItems=await admin.evaluate(async()=> (await (await fetch('/api/v1/resources')).json()).items);
  const published=publicItems.find(item=>item.slug===slug);
  assert.ok(published); assert.match(published.imagePath,/^\/api\/v1\/opportunity-images\//);
  assert.equal((await admin.request.get(origin+published.imagePath)).status(),200);
  await admin.setViewportSize({width:390,height:844});
  await admin.screenshot({path:'artifacts/resource-expiry/admin-mobile.png',fullPage:true});
  assert.ok(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
 } finally {
  if(resourceId) {
   const status=await admin.evaluate(async id=>(await fetch(`/api/v1/admin/resources/${id}`,{method:'DELETE',headers:{'Content-Type':'application/json','Idempotency-Key':'browser-test-cleanup'},body:'{}'})).status,resourceId);
   assert.equal(status,200,'test card cleanup');
  }
 }
 console.log('RESOURCE EXPIRY PASS: mixed/all expired, midnight transition, failure closed, 3 locales × 3 widths, authenticated admin editing/image upload/publish/renew/delete.');
} finally { await browser.close(); }
