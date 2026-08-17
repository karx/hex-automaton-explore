// Smoke the reading landing: live field, Library/Workbench jumps, #s= redirect.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4177';
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.waitForSelector('canvas#cv');
await page.waitForTimeout(2500);

const title = await page.title();
const h1 = await page.locator('.land h1').innerText();
const nav = await page.locator('header nav a').allInnerTexts();
const jumps = await page.locator('.land a.act').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
const live = await page.locator('#liveLine').innerText();
const aliveBefore = await page.evaluate(() => {
  const t = document.getElementById('statusLeft').textContent;
  const m = t.match(/ALIVE ([0-9.]+)%/);
  return m ? Number(m[1]) : 0;
});
await page.locator('.watch-canvas').click({ position: { x: 980, y: 420 } });
await page.waitForTimeout(200);
const seedStatus = await page.locator('#statusLeft').innerText();
await page.screenshot({ path: 'scripts/land-desktop.png', type: 'png' });

const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mob.goto(`${BASE}/`, { waitUntil: 'load' });
await mob.waitForSelector('canvas#cv');
await mob.waitForTimeout(1800);
const mobNav = await mob.locator('header nav a').allInnerTexts();
await mob.screenshot({ path: 'scripts/land-mobile.png', type: 'png' });

await page.goto('about:blank');
await page.goto(`${BASE}/#s=test`, { waitUntil: 'domcontentloaded' });
await page.waitForURL((url) => url.href.includes('/explorations/workbench'), { timeout: 4000 });
const hashUrl = page.url();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.click('text=Enter library');
await page.waitForTimeout(500);
const libUrl = page.url();

await page.goto(`${BASE}/`, { waitUntil: 'load' });
await page.click('text=Open workbench');
await page.waitForTimeout(500);
const wbUrl = page.url();

const okJumps = jumps.includes('./explorations/library.html') && jumps.includes('./explorations/workbench.html');
const okHash = hashUrl.includes('/explorations/workbench') && hashUrl.includes('#s=test');
const okLib = libUrl.includes('/explorations/library');
const okWb = wbUrl.includes('/explorations/workbench');
const okLive = /Resonant Bloom · GEN \d+/.test(live);
const navUp = nav.map((t) => t.toUpperCase());
const okNav = !navUp.includes('HOME') && navUp.includes('LIBRARY') && navUp.includes('WORKBENCH');
const okSeed = seedStatus.toUpperCase().startsWith('SEEDED');

console.log(JSON.stringify({ title, h1, nav, mobNav, jumps, live, seedStatus, aliveBefore, hashUrl, libUrl, wbUrl, errors }, null, 2));

let failed = 0;
function check(label, pass) {
  console.log(`${pass ? 'ok' : 'FAIL'}  ${label}`);
  if (!pass) failed += 1;
}
check('title is landing', title.includes('watch a living hex field'));
check('h1 is reading copy', h1.toUpperCase().includes('NO CLOSED FORM'));
check('CTAs point at library + workbench', okJumps);
check('#s= redirects to workbench', okHash);
check('Enter library lands on library', okLib);
check('Open workbench lands on workbench', okWb);
check('live line ticks generation', okLive);
check('nav has no duplicate Home', okNav);
check('canvas click seeds the field', okSeed);
check('no page errors', errors.length === 0);

await browser.close();
if (failed) process.exit(1);
console.log('smoke-test-landing: all checks passed');
