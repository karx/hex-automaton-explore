import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4177/explorations/library.html', { waitUntil: 'load' });
const cards = await page.locator('.card').count();
const scripts = await page.locator('script').count();
console.log('library cards', cards, 'script tags', scripts);
await page.screenshot({ path: 'scripts/explore-library.png' });

await page.goto('http://localhost:4177/explorations/workbench.html?preset=resonant-bloom&mode=watch', { waitUntil: 'load' });
await page.waitForTimeout(2800);
const genBefore = await page.locator('#statusLeft').innerText();
console.log('watch status', genBefore);
await page.screenshot({ path: 'scripts/explore-watch.png' });

await page.click('[data-mode=steer]');
await page.waitForTimeout(400);
const genAfter = await page.locator('#statusLeft').innerText();
const adv = await page.locator('[data-param]').count();
const drawerOpen = await page.locator('#drawer').evaluate((el) => el.classList.contains('open'));
console.log('after steer', genAfter, 'adv sliders', adv, 'drawer', drawerOpen);
await page.screenshot({ path: 'scripts/explore-workbench-steer.png' });

const nBefore = parseInt((genBefore.match(/GEN (\d+)/) || [])[1] || '0', 10);
const nAfter = parseInt((genAfter.match(/GEN (\d+)/) || [])[1] || '0', 10);
console.log('gen continued', nBefore, '->', nAfter, nAfter >= nBefore);

await page.waitForTimeout(1500);
await page.click('[data-mode=leave]');
await page.waitForTimeout(200);
await page.click('#mint');
await page.waitForSelector('[data-share-preview="1"] img');
const src = await page.locator('[data-share-preview="1"] img').getAttribute('src');
let svg = '';
if (src?.startsWith('blob:')) {
  svg = await page.evaluate(async (u) => await (await fetch(u)).text(), src);
} else if (src?.startsWith('data:')) {
  svg = decodeURIComponent(src.split(',')[1] || '');
}
console.log('mint svg has GROWTH', svg.includes('GROWTH'), 'has SEED', svg.includes('SEED'), 'has THIS FIELD', svg.includes('THIS FIELD'), 'len', svg.length);
await page.screenshot({ path: 'scripts/explore-mint.png' });

console.log('errors', errors.length ? errors : 'none');
await browser.close();
if (errors.length || adv < 10 || nAfter < nBefore || !svg.includes('GROWTH')) process.exit(1);
