// Fail CI if library.html drifted from the generator, or if pageQuery
// stops reading ?preset= / leftover #preset= the way workbench expects.
import { existsSync, readFileSync } from 'fs';
import { buildLibraryHtml } from './generate-library.mjs';
import { pageQuery } from '../src/page-query.js';
import { PRESETS } from '../src/presets.js';
import { FAVORITES } from '../src/favorites.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const expected = buildLibraryHtml().replace(/\r\n/g, '\n');
const actual = readFileSync('explorations/library.html', 'utf8').replace(/\r\n/g, '\n');
check('library.html matches generate-library.mjs', actual === expected);
check('library cards use query, not hash', !actual.includes('#preset=') && !actual.includes('#favorite='));
check('library has a coral-reef query link', actual.includes('workbench.html?preset=coral-reef&amp;mode=watch'));
check('library nav includes 3D and Ant', actual.includes('viewer3d.html') && actual.includes('langtons-ant.html'));

for (const item of [...FAVORITES, ...PRESETS]) {
  const gif = `gifs-v2/${item.id}.gif`;
  check(`${item.id} has a v2 GIF`, existsSync(gif));
  check(`${item.id} card uses its v2 GIF`, actual.includes(`gifs-v2/${item.id}.gif`));
}

const qSearch = pageQuery({ search: '?preset=coral-reef&mode=watch', hash: '' });
check('pageQuery reads ?preset=', qSearch.get('preset') === 'coral-reef' && qSearch.get('mode') === 'watch');

const qHash = pageQuery({ search: '', hash: '#preset=stable-crystal' });
check('pageQuery falls back to #preset=', qHash.get('preset') === 'stable-crystal');

const qShare = pageQuery({ search: '', hash: '#s=not-a-query' });
check('pageQuery ignores #s= share tokens', qShare.get('preset') == null);

if (failed) {
  console.error(`\nverify-library: ${failed} check(s) failed. If the HTML is stale, run: npm run library`);
  process.exit(1);
}
console.log('\nverify-library: all checks passed');
