import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4179/index.html', { waitUntil: 'load' });
await page.waitForSelector('#presetSelect');
await page.selectOption('#presetSelect', 'coral-echo');
await page.waitForTimeout(6000); // let it grow to an interesting mid-growth phase
await page.screenshot({ path: 'scripts/coral-echo-ui.png' });

console.log('Console/page errors:', errors.length ? errors : 'none');
await browser.close();
