import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Uses an existing Playwright installation; no runtime dependency is added to the site.
const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath) throw new Error('Set PLAYWRIGHT_MODULE to the installed Playwright index.mjs path.');
const { chromium } = await import(pathToFileURL(modulePath).href);
const origin = process.env.PRICES_ORIGIN || 'http://127.0.0.1:4173';
const copies = await Promise.all(['en','fr','ar'].map(async lang => JSON.parse(await readFile(`src/pages/prices/copy.${lang}.json`,'utf8'))));
function shape(value) { return Array.isArray(value) ? value.map(shape) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,child])=>[key,shape(child)])) : typeof value; }
for (const copy of copies) {
 assert.deepEqual(shape(copy), shape(copies[0]), 'Every locale must contain the same complete Prices content');
 assert.equal(copy.tiers.length,3); assert.equal(copy.refunds.length,5); assert.equal(copy.faqs.length,7);
 assert.match(copy.inquiryMessage,/\{\{tier\}\}/); assert.match(copy.inquiryMessage,/\{\{price\}\}/);
}
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/opt/google/chrome/chrome',args:['--no-sandbox']});
const results=[];
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('astep-locale','en'));
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`${origin}/prices`);
 await page.locator('.price-closing').waitFor(); await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('h1').count(),1);
 assert.equal(await page.locator('.price-tier').count(),3);
 assert.equal(await page.locator('.prices-page > section').count(),11);
 for (let i=0;i<3;i++) {
  const card=page.locator('.price-tier').nth(i);
  const href=await card.locator('a').getAttribute('href');
  const url=new URL(href);
  assert.equal(url.hostname,'wa.me');
  assert.match(url.searchParams.get('text'),new RegExp(copies[0].tiers[i].name));
  assert.match(url.searchParams.get('text'),new RegExp(String([6000,32000,97000][i])));
 }
 // Verify external navigation without sending any message or contacting WhatsApp.
 await context.route('https://wa.me/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Intercepted inquiry</title>'}));
 const popupPromise=page.waitForEvent('popup');
 await page.locator('.price-tier--premium a').click();
 const popup=await popupPromise; await popup.waitForLoadState();
 assert.match(new URL(popup.url()).searchParams.get('text'),/Premium.*97000/); await popup.close();
 await page.getByRole('tab',{name:'Professional',exact:true}).click();
 assert.equal(await page.locator('#price-tab-professional').getAttribute('aria-selected'),'true');
 assert.match(await page.locator('#price-coverage').innerText(),/32000DA/);
 assert.match(await page.locator('#price-coverage a').getAttribute('href'),/32000/);
 await page.locator('#price-tab-professional').press('ArrowRight');
 assert.equal(await page.locator('#price-tab-premium').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#price-coverage .price-covered').count(),5);
 await page.locator('#price-tab-premium').press('Home');
 assert.equal(await page.locator('#price-tab-standard').getAttribute('aria-selected'),'true');
 results.push('Tier prices, contextual WhatsApp links, intercepted CTA navigation, tab pointer/keyboard selection: passed');
 const refunds=page.locator('.price-refund details');
 await refunds.nth(2).locator('summary').click();
 assert.equal(await refunds.nth(2).getAttribute('open'),'');
 assert.equal(await refunds.nth(0).getAttribute('open'),null);
 assert.match(await refunds.nth(2).innerText(),/50% refund/);
 await refunds.nth(0).locator('summary').click();
 const faqs=page.locator('.price-faq details');
 await faqs.nth(1).locator('summary').focus(); await page.keyboard.press('Enter');
 assert.equal(await faqs.nth(1).getAttribute('open'),'');
 assert.equal(await faqs.nth(0).getAttribute('open'),null);
 await faqs.nth(0).locator('summary').click();
 await page.locator('.price-hero-art').click();
 await page.waitForURL('**/prices#packages');
 assert.ok(Math.abs(await page.locator('#packages').evaluate(el=>el.getBoundingClientRect().top)-100)<3);
 assert.equal(await page.locator('.price-hero-art img').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 const header=await page.locator('header').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el.querySelector('nav a')).color}));
 assert.equal(header.color,'rgb(14, 123, 229)');
 assert.equal(header.background,'rgba(0, 0, 0, 0)');
 results.push('Accordions (mouse/keyboard), package anchor, transparent scrolled header with blue links and reduced motion: passed');
 await page.locator('.price-guide a').first().click(); await page.waitForURL('**/guides');
 await page.goto(`${origin}/prices`); await page.locator('.price-terms-note a').click(); await page.waitForURL('**/terms');
 await page.goto(`${origin}/prices`); await page.locator('.price-closing').waitFor();
 assert.equal(await page.locator('.price-closing a[href^="mailto:"]').getAttribute('href'),'mailto:contact@astepimmigration.space');
 results.push('Guides, Terms and email destinations: passed');
 // Scoped header/footer classes must disappear on existing routes after visiting Prices.
 for (const route of ['/resources','/contact','/about','/']) {
  await page.goto(origin+route); await page.locator('footer#astep-footer').waitFor();
  assert.equal(await page.locator('header.prices-navbar').count(),0);
  assert.equal(await page.locator('footer#astep-footer').count(),1);
  if(route==='/resources') await page.locator('.resources-page').waitFor();
 }
 results.push('Resources implemented; shared header/footer present on Resources, Contact, About and Home: passed');
 for (const [lang,copy] of ['en','fr','ar'].map((lang,i)=>[lang,copies[i]])) {
  const path=lang==='en'?'/prices':`/${lang}/prices`;
  await page.goto(origin+path); await page.locator('.prices-page').waitFor();
  assert.equal(await page.locator('h1').textContent(),copy.heroTitle);
  assert.equal(await page.locator('html').getAttribute('dir'),lang==='ar'?'rtl':'ltr');
  await page.reload(); await page.locator('.prices-page').waitFor();
  assert.equal(await page.locator('.price-guide a').first().getAttribute('href'),lang==='en'?'/guides':`/${lang}/guides`);
  for (const width of [1440,1024,768,390,320]) {
   await page.setViewportSize({width,height:900});
   await page.evaluate(()=>document.fonts.ready);
   const overflow=await page.locator('.prices-page').evaluate(el=>el.scrollWidth>innerWidth);
   assert.equal(overflow,false,`${lang} at ${width}px overflows`);
   const outside=await page.locator('.prices-page h1,.prices-page h2,.price-button,.price-tabs button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(n=>n.textContent));
   assert.deepEqual(outside,[],`${lang} at ${width}px has clipped headings/controls`);
   if(width===390 || (width===1440 && lang==='en')) {
    await page.locator('.price-closing').scrollIntoViewIfNeeded(); await page.locator('.price-closing img').evaluate(im=>{ im.loading='eager'; }); await page.waitForFunction(()=>{const im=document.querySelector('.price-closing img'); return im?.complete && im.naturalWidth>0;});
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`artifacts/prices-${lang}-${width}.png`,fullPage:true});
   }
  }
 }
 results.push('All three locales refresh, translate, retain destinations and fit 1440/1024/768/390/320px: passed');
 await page.setViewportSize({width:390,height:844}); await page.goto(`${origin}/prices`);
 await page.getByRole('button',{name:'Open navigation menu'}).click();
 await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Change language: FR',exact:true}).click(); await page.waitForURL('**/fr/prices');
 await page.getByRole('heading',{level:1,name:copies[1].heroTitle,exact:true}).waitFor();
 assert.equal(await page.locator('h1').textContent(),copies[1].heroTitle);
 results.push('Mobile drawer opens/closes and language switch preserves Prices: passed');
 await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({reducedMotion:'no-preference'}); await page.goto(`${origin}/prices`);
 assert.equal(await page.locator('.price-hero-art img').evaluate(el=>getComputedStyle(el).animationName),'price-float');
 for (let index=0; index<3; index++) {
  const step=page.locator('.price-booking-steps li').nth(index);
  await step.locator('.price-step-trigger').click();
  assert.match(await step.getAttribute('class'), /price-booking-step--active/);
  await page.waitForTimeout(250);
  assert.equal(await step.locator('span').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(14, 128, 233)');
 }
 results.push('All three booking steps activate their blue highlight: passed');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'smooth');
 await page.locator('.price-tier--professional').hover();
 await page.waitForTimeout(300);
 const hover=await page.locator('.price-tier--professional').evaluate(el=>({transform:getComputedStyle(el).transform,glow:getComputedStyle(el,'::before').opacity}));
 assert.notEqual(hover.transform,'none'); assert.equal(hover.glow,'1');
 results.push('Normal motion: floating hero, smooth scrolling and hover glow/lift: passed');
 assert.deepEqual(errors,[],'No browser runtime errors');
 await writeFile('artifacts/prices-verification.json',JSON.stringify({passed:true,results,errors},null,2));
 console.log(results.join('\n')); console.log('PRICES_BROWSER_CHECKS_PASSED');
} finally { await browser.close(); }
