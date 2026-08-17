import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function shot(page, name) {
  await page.screenshot({ path: `scripts/shell-${name}.png`, fullPage: false });
}

const errors = [];

async function checkPage(url, label, mobile) {
  const page = await browser.newPage({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: !!mobile,
    hasTouch: !!mobile,
  });
  page.on('pageerror', (e) => errors.push(`${label}: ${e}`));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const topbar = await page.locator('#topbar').count();
  const status = await page.locator('#statusbar').count();
  const panelVisible = await page.locator('#panel').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.x < window.innerWidth - 8;
  });
  console.log(`[${label}] topbar=${topbar} status=${status} panelInView=${panelVisible}`);
  await shot(page, label);
  if (mobile) {
    await page.click('#panelToggle');
    await page.waitForTimeout(250);
    const open = await page.locator('#panel').evaluate((el) => el.getBoundingClientRect().x < window.innerWidth - 20);
    console.log(`[${label}] panel after toggle=${open}`);
    await shot(page, `${label}-panel`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  await page.close();
}

await checkPage('http://localhost:4177/explorer.html', '2d-desktop', false);
await checkPage('http://localhost:4177/explorer.html', '2d-mobile', true);
await checkPage('http://localhost:4177/viewer3d.html', '3d-desktop', false);
await checkPage('http://localhost:4177/viewer3d.html', '3d-mobile', true);
await checkPage('http://localhost:4177/langtons-ant.html', 'ant-desktop', false);
await checkPage('http://localhost:4177/langtons-ant.html', 'ant-mobile', true);

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
if (errors.length) process.exit(1);
