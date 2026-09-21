import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/home/djouadimounsaf/.cache/ms-playwright-go/1.57.0/package/index.mjs');
const origin = process.env.NAVBAR_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/google/chrome/chrome', args: ['--no-sandbox'] });
const errors = [];
try {
  const page = await browser.newPage({ locale: 'en-US', reducedMotion: 'no-preference' });
  page.on('pageerror', error => errors.push(error.message));
  for (const locale of ['en', 'fr', 'ar']) {
    for (const route of ['', '/opportunities', '/guides', '/about', '/contact', '/prices', '/resources']) {
      await page.goto(`${origin}${locale === 'en' ? '' : '/' + locale}${route || '/'}`);
      await page.locator('main h1').waitFor();
      for (const width of [1440, 1024, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const state = await page.locator('.astep-navbar').evaluate(header => {
          const links = [...header.querySelectorAll('nav a')];
          const controls = [...header.querySelectorAll('a,button')].filter(el => el.getBoundingClientRect().width > 0);
          return {
            height: header.getBoundingClientRect().height,
            background: getComputedStyle(header).backgroundColor,
            colors: links.map(el => getComputedStyle(el).color),
            switcher: getComputedStyle(header.querySelector('.navbar-languages')).backgroundColor,
            clipped: controls.some(el => { const r = el.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }),
            logo: header.querySelector('img').getAttribute('src'),
          };
        });
        assert.equal(state.height, 80, `${locale}${route}/${width}: header height`);
        assert.equal(state.background, 'rgba(0, 0, 0, 0)');
        assert.ok(state.colors.every(color => color === 'rgb(14, 123, 229)'));
        assert.equal(state.switcher, 'rgb(255, 94, 89)');
        assert.equal(state.clipped, false, `${locale}${route}/${width}: clipped controls`);
        assert.match(state.logo, /logo-blue/);
      }
    }
    await page.locator('header button[aria-haspopup="dialog"]').click();
    const drawer = page.locator('.navbar-drawer');
    await drawer.waitFor();
    assert.equal(await drawer.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await drawer.evaluate(el => getComputedStyle(el).animationName), 'navbar-slide-in');
    assert.equal(await drawer.evaluate(el => getComputedStyle(el).getPropertyValue('--drawer-entry').trim()), locale === 'ar' ? '-100%' : '100%');
    assert.equal(await drawer.locator('.navbar-languages').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 94, 89)');
    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('header button[aria-haspopup="dialog"]').evaluate(el => el === document.activeElement), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('header button[aria-haspopup="dialog"]').click();
    await drawer.waitFor();
    assert.equal(await drawer.evaluate(el => getComputedStyle(el).animationName), 'none');
    await drawer.locator('nav a').filter({ hasText: locale === 'ar' ? 'الأسعار' : locale === 'fr' ? 'Tarifs' : 'Prices' }).click();
    await page.waitForURL('**/prices');
    await drawer.waitFor({ state: 'hidden' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  await page.locator('header .navbar-languages button').filter({ hasText: /^EN$/ }).click();
  await page.waitForURL(`${origin}/prices`);
  assert.deepEqual(errors, []);
  console.log('NAVBAR PASS: 7 pages × 3 languages × 5 widths; shared styling, RTL slide, reduced motion, focus return, mobile navigation and language switching.');
} finally { await browser.close(); }
