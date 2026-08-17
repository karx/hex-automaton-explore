// Writes explorations/library.html once from the preset library + on-disk
// GIFs/stills. Re-run after adding a preset, a favorite, or a showcase GIF.
import { writeFileSync, existsSync } from 'fs';
import { PRESETS } from '../src/presets.js';
import { FAVORITES } from '../src/favorites.js';

const GIFS_V2 = {
  'stable-crystal': '../gifs-v2/stable-crystal.gif',
  'resonant-bloom': '../gifs-v2/resonant-bloom.gif',
  'ember-bloom': '../gifs-v2/ember-bloom.gif',
  'drifting-vortex': '../gifs-v2/drifting-vortex.gif',
  'pulsing-heart': '../gifs-v2/pulsing-heart.gif',
  'charged-current': '../gifs-v2/charged-current.gif',
};

const FALLBACK = {
  'coral-reef': '../gifs/dense-coral.gif',
  'storm-field': '../gifs/storm-field.gif',
  'sparse-ember': '../gifs/ember-ring.gif',
  'spreading-front': '../gifs/spreading-front-ring.gif',
  'fault-line': '../gifs/fault-line.gif',
  'resonant-vortex': '../gifs/vortex-drift.gif',
  'pulse-current': '../gifs/storm-field.gif',
};

function xe(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function thumbFor(p) {
  const rel = GIFS_V2[p.id] || FALLBACK[p.id];
  if (!rel) return null;
  const disk = rel.replace('../', '');
  return existsSync(disk) ? rel : null;
}

function firstLine(desc) {
  const line = String(desc).split(/[.—]/)[0].trim();
  return line.endsWith('.') ? line : `${line}.`;
}

function card(href, kind, seedType, name, desc, src) {
  const media = src
    ? `<img src="${xe(src)}" alt="${xe(name)}">`
    : `<span class="ph">${xe(seedType.toUpperCase())}</span>`;
  return `      <a class="card" href="${xe(href)}">
        <div class="thumb">${media}</div>
        <div class="body">
          <div class="k">${xe(kind)} · ${xe(seedType)}</div>
          <div class="n">${xe(name)}</div>
          <div class="d">${xe(firstLine(desc))}</div>
        </div>
      </a>`;
}

const favCards = FAVORITES.map((f) => card(
  `./workbench.html?favorite=${f.id}&mode=watch#favorite=${f.id}`,
  'Favorite',
  f.seedType,
  f.name,
  f.description,
  null,
)).join('\n');

const cards = PRESETS.map((p) => card(
  `./workbench.html?preset=${p.id}&mode=watch#preset=${p.id}`,
  p.discovered ? 'Discovered' : 'Classic',
  p.seedType,
  p.name,
  p.description,
  thumbFor(p),
)).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>Library — Hex Automaton Explorations</title>
<link rel="stylesheet" href="./explore.css" />
</head>
<body>
  <header class="top">
    <span class="brand">HEX AUTOMATON</span>
    <span class="crumb">›</span>
    <span class="here">Library</span>
    <nav>
      <a href="../index.html">Home</a>
      <a href="./library.html" aria-current="page">Library</a>
      <a href="./workbench.html">Workbench</a>
      <a href="../explorer.html">2D</a>
    </nav>
  </header>
  <div class="scroll">
    <h1>Library</h1>
    <p class="lede">Pick a field by seeing it. Generated once from favorites + the preset list — re-run <code>node scripts/generate-library.mjs</code> after a new favorite, preset, or GIF. Click enters Watch on the workbench (same field, no remount when you Steer).</p>
    <h2>Favorites</h2>
    <div class="grid">
${favCards}
    </div>
    <h2>Presets</h2>
    <div class="grid">
${cards}
    </div>
  </div>
  <footer class="status">
    <span>Browse → Watch → Steer</span>
    <span>Static · ${FAVORITES.length} favorite${FAVORITES.length === 1 ? '' : 's'} · ${PRESETS.length} presets</span>
  </footer>
</body>
</html>
`;

writeFileSync('explorations/library.html', html);
console.log(`wrote explorations/library.html (${FAVORITES.length} favorites, ${PRESETS.length} presets)`);
