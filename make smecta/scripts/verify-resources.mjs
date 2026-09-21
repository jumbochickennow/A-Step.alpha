import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { transform } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/djouadimounsaf/.cache/ms-playwright-go/1.57.0/package/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
const origin = process.env.RESOURCES_ORIGIN || 'http://127.0.0.1:4173';
await mkdir('artifacts/resources', { recursive: true });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
 // Keep the original four-card visual check deterministic now that live cards expire.
 const source = await transform(await readFile('src/pages/resources/copy.ts', 'utf8'), { loader:'ts', format:'esm' });
 const { resourcesCopy } = await import(`data:text/javascript;base64,${Buffer.from(source.code).toString('base64')}`);
 const fixtures = resourcesCopy.en.events.map((event, index) => ({ id:String(index), published:true, featured:index<2, deadline:'2099-12-31', applyUrl:'https://erasmus-plus.ec.europa.eu/opportunities/individuals', imagePath:index<2?`/assets/resources/${['british-council','khotwa'][index]}.webp`:null, translations:Object.fromEntries(['en','fr','ar'].map(locale=>[locale,{title:resourcesCopy[locale].events[index].title,description:resourcesCopy[locale].events[index].body}])) }));
 await page.route('**/api/v1/resources', route => route.fulfill({ contentType:'application/json', body:JSON.stringify({ now:Date.now(), items:fixtures }) }));
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 for (const locale of ['en', 'fr', 'ar']) {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  await page.goto(`${origin}${prefix}/resources`);
  await page.waitForSelector('.resource-card');
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.resource-card').count(), 4);
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
  assert.equal(await page.locator('.resources-prices').getAttribute('href'), `${prefix}/prices`);
  assert.equal(await page.locator('footer').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(14, 123, 229)');
  for (const link of await page.locator('.resource-register').all()) {
   assert.equal(await link.getAttribute('href'), 'https://erasmus-plus.ec.europa.eu/opportunities/individuals');
   assert.equal(await link.getAttribute('target'), '_blank');
   assert.match(await link.getAttribute('rel'), /noopener/);
  }
  for (const width of [1440, 768, 390, 320]) {
   await page.setViewportSize({ width, height: 1000 });
   await page.locator('footer').scrollIntoViewIfNeeded();
   await page.waitForFunction(() => [...document.querySelectorAll('.resources-page img')].every(img => img.complete && img.naturalWidth > 0));
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${locale}/${width}: overflow`);
   assert.ok(await page.locator('.resource-card').evaluateAll(cards => cards.every(el => el.scrollWidth <= el.clientWidth)), `${locale}/${width}: card overflow`);
   await page.evaluate(() => scrollTo({ top:0, behavior:'instant' }));
   await page.waitForFunction(() => scrollY === 0);
   await page.screenshot({ path: `artifacts/resources/${locale}-${width}.png`, fullPage: true, animations: 'disabled' });
  }
  const requests = [];
  const observe = request => { if (request.method() === 'POST') requests.push(request.url()); };
  page.on('request', observe);
  await page.locator('#resources-newsletter-email').fill('preview@example.com');
  await page.locator('.resources-footer button[type=submit]').click();
  assert.ok((await page.locator('.resources-footer [role=status]').innerText()).length > 10);
  assert.deepEqual(requests, []);
  page.off('request', observe);
 }
 await page.setViewportSize({ width:1440, height:1000 });
 await page.goto(`${origin}/resources`);
 await page.waitForSelector('.resource-card');
 await page.locator('header button').filter({ hasText: /^FR$/ }).click();
 await page.waitForURL('**/fr/resources');
 await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('À la une'));
 assert.match(await page.locator('h1').innerText(), /À la une/);
 await page.locator('header button').filter({ hasText: /^AR$/ }).click();
 await page.waitForURL('**/ar/resources');
 await page.waitForFunction(() => document.querySelector('h1')?.textContent.includes('أبرز'));
 assert.match(await page.locator('h1').innerText(), /أبرز/);
 await page.locator('header button').filter({ hasText: /^EN$/ }).click();
 await page.waitForURL('**/resources');
 await page.waitForFunction(() => document.documentElement.lang === 'en');
 await page.waitForTimeout(800);
 await page.locator('.resource-register').first().hover();
 await page.waitForFunction(() => getComputedStyle(document.querySelector('.resource-card')).transform !== 'none');
 await page.locator('.resource-register').first().focus();
 assert.equal(await page.locator('.resource-register').first().evaluate(el => el === document.activeElement), true);
 await page.route('https://erasmus-plus.ec.europa.eu/**', route => route.fulfill({ status:200, body:'External destination checked' }));
 const popupPromise = page.waitForEvent('popup');
 await page.locator('.resource-register').first().click();
 const popup = await popupPromise;
 await popup.waitForLoadState();
 assert.match(popup.url(), /^https:\/\/erasmus-plus\.ec\.europa\.eu\//);
 await popup.close();
 await page.emulateMedia({ reducedMotion:'reduce' });
 assert.equal(await page.locator('.resources-calendar').evaluate(el => getComputedStyle(el).animationName), 'none');
 assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior), 'auto');
 await page.setViewportSize({ width:390, height:844 });
 await page.locator('header button[aria-haspopup=dialog]').click();
 assert.equal(await page.locator('[role=dialog]').isVisible(), true);
 await page.keyboard.press('Escape');
 await page.locator('[role=dialog]').waitFor({state:'hidden'});
 await page.locator('.resources-prices').click();
 await page.waitForURL('**/prices');
 await page.waitForSelector('.price-closing');
 assert.equal(await page.locator('footer#astep-footer').count(), 1);
 assert.deepEqual(errors, []);
 console.log('RESOURCES PASS: 3 locales × 4 widths, assets, links, popup redirect, menu, newsletter preview, reduced motion and Prices regression');
} finally { await browser.close(); }
