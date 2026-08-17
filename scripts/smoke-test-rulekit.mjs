// Browser regression test for the export/import/formula UI on explorer.html
// (2D) and viewer3d.html (3D). Requires a static server at :4177 (see README).
import { chromium } from 'playwright';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function testPage(url, label) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#presetSelect');
  await page.waitForTimeout(1500);

  // switch to a distinctive preset so we can verify round-trip identity
  await page.selectOption('#presetSelect', 'drifting-vortex');
  await page.waitForTimeout(1000);

  // Export WITH state, via the actual Download button (intercepting the download)
  await page.check('#exportIncludeState');
  await page.fill('#exportName', 'Round Trip Test');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#downloadJsonBtn'),
  ]);
  const path = await download.path();
  const fs = await import('fs');
  const exportedText = fs.readFileSync(path, 'utf-8');
  const exported = JSON.parse(exportedText);

  console.log(`[${label}] export ok: kind=${exported.kind} hasState=${!!exported.state} grid=${exported.grid.width}x${exported.grid.height} paramsCount=${Object.keys(exported.params).length}`);

  // Paste it back into the import textarea and load
  await page.fill('#importText', exportedText);
  await page.click('#loadKitBtn');
  await page.waitForTimeout(500);
  const importStatus = await page.locator('#importStatus').innerText();
  console.log(`[${label}] import status: ${importStatus}`);

  // formula panel only exists on 2D
  const hasFormula = await page.locator('#formulaText').count();
  if (hasFormula) {
    const formulaText = await page.locator('#formulaText').innerText();
    console.log(`[${label}] formula panel present, length=${formulaText.length}, has BIRTH/SURVIVAL/ENERGY/MOMENTUM sections:`,
      ['BIRTH', 'SURVIVAL', 'ENERGY', 'MOMENTUM'].every((s) => formulaText.includes(s)));
  }

  await page.screenshot({ path: `scripts/rulekit-${label}.png` });
  console.log(`[${label}] console/page errors:`, errors.length ? errors : 'none');
  await page.close();
}

await testPage('http://localhost:4177/explorer.html', '2d');
await testPage('http://localhost:4177/viewer3d.html', '3d');

await browser.close();
