// Full-UI screenshots of the 2D explorer and 3D viewer for the README.
// Requires a static server: npx serve -l 4176 .
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4176';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function shot(page, path, waitMs) {
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path, type: 'png' });
  console.log(path);
}

const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
await page.waitForSelector('canvas#cv');
await shot(page, 'docs/shots/ui-2d.png', 7000);

await page.selectOption('#presetSelect', 'resonant-bloom');
await shot(page, 'docs/shots/ui-2d-resonant-bloom.png', 5500);

await page.goto(`${BASE}/viewer3d.html`, { waitUntil: 'load' });
await page.waitForSelector('#sceneWrap canvas');
await page.waitForTimeout(4000);
const box = await page.locator('#sceneWrap').boundingBox();
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.55 + 200, box.y + box.height * 0.5 - 90, { steps: 18 });
await page.mouse.up();
await shot(page, 'docs/shots/ui-3d.png', 3500);

await page.selectOption('#presetSelect', 'charged-current');
await shot(page, 'docs/shots/ui-3d-charged-current.png', 5000);

console.log('Console/page errors:', errors.length ? errors : 'none');
await browser.close();
