import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:4178/langtons-arm.html', { waitUntil: 'load' });
await page.waitForSelector('canvas#cv');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'scripts/arm-01-default.png' });

// jump to 100k
await page.click('[data-jump="100000"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/arm-02-100k.png' });

// try an invalid rule
await page.fill('#ruleInput', 'LRX');
await page.click('#applyRuleBtn');
await page.waitForTimeout(300);
const errStatus = await page.locator('#ruleStatus').innerText();
console.log('invalid rule status:', errStatus);

// try a different valid rule
await page.fill('#ruleInput', 'RRLL');
await page.click('#applyRuleBtn');
await page.waitForTimeout(300);
await page.click('[data-jump="10000"]');
await page.waitForTimeout(500);
await page.screenshot({ path: 'scripts/arm-03-rrll-10k.png' });

// pause, single-step
await page.click('#playBtn');
await page.click('#stepBtn');
await page.click('#stepBtn');
await page.waitForTimeout(200);
const metrics = await page.locator('#metrics').innerText();
console.log('metrics after pause+2 steps:', metrics);

console.log('Console/page errors:', errors.length ? errors : 'none');
await browser.close();
