import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4174', { waitUntil: 'load' });
await page.waitForSelector('canvas#cv');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/v2-01-default.png' });

// switch to a discovered preset
await page.selectOption('#presetSelect', 'resonant-bloom');
await page.waitForTimeout(2500);
await page.screenshot({ path: 'scripts/v2-02-resonant-bloom.png' });

// drag survival pressure slider to robust extreme
await page.fill('#pressureSlider', '1');
await page.dispatchEvent('#pressureSlider', 'input');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'scripts/v2-03-pressure-max.png' });

// toggle off density + energy, isolate momentum arrows
await page.uncheck('#layerDensity');
await page.uncheck('#layerEnergy');
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/v2-04-momentum-only.png' });
await page.check('#layerDensity');
await page.check('#layerEnergy');

// open advanced raw params
await page.click('details summary');
await page.waitForTimeout(300);
await page.screenshot({ path: 'scripts/v2-05-advanced.png' });

console.log('Console/page errors:', errors.length ? errors : 'none');
await browser.close();
