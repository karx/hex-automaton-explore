// Regression smoke test for the 3D viewer: loads viewer3d.html in headless
// Chromium (with software-GL flags, since headless Chromium has no real GPU),
// exercises preset switching, ontology sliders, camera orbit, and layer
// isolation, and checks for console/page errors. Requires a static file
// server running at http://localhost:4175 (see README "Quick start").
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4175/viewer3d.html', { waitUntil: 'load' });
await page.waitForSelector('canvas');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/3d-01-default.png' });

// orbit the camera via drag
const box = await page.locator('#sceneWrap').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 - 80, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'scripts/3d-02-orbited.png' });

// isolate momentum layer only
await page.uncheck('#layerDensity');
await page.uncheck('#layerEnergy');
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/3d-03-momentum-only.png' });
await page.check('#layerDensity');
await page.check('#layerEnergy');

// switch preset + drag survival pressure to max
await page.selectOption('#presetSelect', 'storm-field');
await page.waitForTimeout(1500);
await page.fill('#pressureSlider', '1');
await page.dispatchEvent('#pressureSlider', 'input');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'scripts/3d-04-storm-pressure-max.png' });

// toggle beams off
await page.uncheck('#layerBeams');
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/3d-05-no-beams.png' });

console.log('Console/page errors:', errors.length ? errors : 'none');
await browser.close();
