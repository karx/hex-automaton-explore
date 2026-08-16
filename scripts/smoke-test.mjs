import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4173', { waitUntil: 'load' });
await page.waitForSelector('canvas');
await page.waitForTimeout(3000); // let a few generations run

await page.screenshot({ path: 'scripts/smoke-test-1.png' });

// switch variant and re-screenshot
await page.selectOption('#variantSelect', 'pulsar');
await page.waitForTimeout(2000);
await page.screenshot({ path: 'scripts/smoke-test-2.png' });

console.log('Console/page errors:', errors.length ? errors : 'none');

await browser.close();
