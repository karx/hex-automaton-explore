// Browser check for share-card controls. Requires a static server at :4177.
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const context = await browser.newContext({
  viewport: { width: 1500, height: 950 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const page = await context.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4177/index.html', { waitUntil: 'load' });
await page.waitForSelector('#previewCardBtn');
await page.waitForTimeout(1800);

await page.click('#previewCardBtn');
await page.waitForSelector('[data-share-preview="1"] img');
const previewSrc = await page.locator('[data-share-preview="1"] img').getAttribute('src');
console.log('2d preview opened, svg data url:', previewSrc?.startsWith('data:image/svg+xml'));
await page.screenshot({ path: 'scripts/share-card-preview-2d.png' });
await page.click('[data-share-preview="1"]');
await page.waitForTimeout(200);
const previewGone = await page.locator('[data-share-preview="1"]').count();
console.log('2d preview dismissed:', previewGone === 0);

await page.click('#copyShareTextBtn');
await page.waitForTimeout(200);
const textStatus = await page.locator('#shareStatus').innerText();
const copiedText = await page.evaluate(() => navigator.clipboard.readText());
console.log('2d copy text status:', textStatus);
console.log('2d share text has deep link:', copiedText.includes('#s='), 'has HEX AUTOMATON:', copiedText.includes('HEX AUTOMATON'));

await page.click('#copyShareLinkBtn');
await page.waitForTimeout(200);
const linkStatus = await page.locator('#shareStatus').innerText();
const copiedLink = await page.evaluate(() => navigator.clipboard.readText());
console.log('2d copy link status:', linkStatus);
console.log('2d share link:', copiedLink.slice(0, 80) + '…');

const hash = copiedLink.includes('#') ? copiedLink.slice(copiedLink.indexOf('#')) : '';
await page.goto(`http://localhost:4177/index.html${hash}`, { waitUntil: 'load' });
await page.waitForTimeout(800);
const loadStatus = await page.locator('#shareStatus').innerText();
console.log('2d hash load status:', loadStatus);

await page.goto('http://localhost:4177/viewer3d.html', { waitUntil: 'load' });
await page.waitForSelector('#previewCardBtn');
await page.waitForTimeout(1500);
await page.click('#previewCardBtn');
await page.waitForSelector('[data-share-preview="1"] img');
console.log('3d preview opened');
await page.screenshot({ path: 'scripts/share-card-preview-3d.png' });
await page.click('[data-share-preview="1"]');

console.log('console/page errors:', errors.length ? errors : 'none');
await browser.close();
