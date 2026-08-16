// Fail CI if SEO assets or required head tags go missing.
import { readFileSync, statSync } from 'fs';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const pages = [
  {
    file: 'index.html',
    title: 'Hex Automaton — Live 2D field explorer',
    canonical: 'https://karx.github.io/hex-automaton-explore/',
  },
  {
    file: 'viewer3d.html',
    title: 'Hex Automaton — 3D stacked field layers',
    canonical: 'https://karx.github.io/hex-automaton-explore/viewer3d.html',
  },
  {
    file: 'langtons-arm.html',
    title: "Langton's Arm — Hex ant, no highway",
    canonical: 'https://karx.github.io/hex-automaton-explore/langtons-arm.html',
  },
];

const requiredAssets = [
  'og-image.png',
  'favicon.svg',
  'favicon-32x32.png',
  'favicon-192.png',
  'favicon-512.png',
  'apple-touch-icon.png',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml',
];

for (const a of requiredAssets) {
  let ok = false;
  try { ok = statSync(a).size > 0; } catch { ok = false; }
  check(`asset ${a}`, ok);
}

const og = statSync('og-image.png');
check(`og-image.png under 300KB (${Math.round(og.size / 1024)}KB)`, og.size < 300 * 1024);

for (const p of pages) {
  const html = readFileSync(p.file, 'utf8');
  check(`${p.file} has viewport`, html.includes('name="viewport"'));
  check(`${p.file} title`, html.includes(`<title>${p.title}</title>`));
  check(`${p.file} canonical`, html.includes(`rel="canonical" href="${p.canonical}"`));
  check(`${p.file} og:image absolute https`, html.includes('og:image" content="https://karx.github.io/hex-automaton-explore/og-image.png"'));
  check(`${p.file} twitter:card`, html.includes('twitter:card" content="summary_large_image"'));
  check(`${p.file} JSON-LD`, html.includes('application/ld+json'));
  check(`${p.file} lang+og prefix`, html.includes('lang="en"') && html.includes('og: https://ogp.me/ns#'));
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  if (titleMatch) check(`${p.file} title < 60 chars (${titleMatch[1].length})`, titleMatch[1].length < 60);
  const descMatch = html.match(/name="description" content="([^"]+)"/);
  if (descMatch) {
    const n = descMatch[1].length;
    check(`${p.file} description 120-160 (${n})`, n >= 120 && n <= 160);
  } else {
    check(`${p.file} description present`, false);
  }
  const ld = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/);
  if (ld) {
    try {
      const obj = JSON.parse(ld[1]);
      check(`${p.file} JSON-LD parses`, obj['@type'] === 'WebApplication' && obj.url === p.canonical);
    } catch (e) {
      check(`${p.file} JSON-LD parses (${e.message})`, false);
    }
  }
}

const robots = readFileSync('robots.txt', 'utf8');
check('robots.txt points at sitemap', robots.includes('https://karx.github.io/hex-automaton-explore/sitemap.xml'));

const sitemap = readFileSync('sitemap.xml', 'utf8');
check('sitemap has all three pages',
  sitemap.includes('https://karx.github.io/hex-automaton-explore/</loc>')
  && sitemap.includes('viewer3d.html')
  && sitemap.includes('langtons-arm.html'));

const manifest = JSON.parse(readFileSync('site.webmanifest', 'utf8'));
check('manifest start_url is project Pages path', manifest.start_url === '/hex-automaton-explore/');
check('manifest has 192 and 512 icons', manifest.icons.some((i) => i.sizes === '192x192') && manifest.icons.some((i) => i.sizes === '512x512'));

if (failed) {
  console.error(`\nverify-seo: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-seo: all checks passed');
