import { Engine } from '../src/engine.js';
import { getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { generateCompactFormula } from '../src/formula.js';
import { buildCardData, classifyOutcome } from '../src/share-data.js';
import { generateShareCardSVG } from '../src/share-card.js';
import { buildShareText } from '../src/share-text.js';
import { encodeSharePayload, decodeSharePayload, parseShareHash, generateShareUrl } from '../src/share-url.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const preset = getPreset('resonant-bloom');
const params = getPresetParams(preset);
const engine = new Engine(40, 40, params, getPresetSeedFn(preset));
for (let i = 0; i < 80; i++) engine.step();

const data = buildCardData({
  engine,
  name: 'Resonant Bloom',
  provenance: {
    presetId: preset.id,
    presetName: preset.name,
    archetype: preset.archetype,
    survivalPressure: preset.survivalPressure,
    momentumBias: preset.momentumBias,
  },
  date: '2026-08-18',
});

check('assembler has compact formula (4 lines)', Array.isArray(data.formulaLines) && data.formulaLines.length === 4);
check('formula mentions BIRTH/SURVIVE/ENERGY/MOMENTUM', ['BIRTH', 'SURVIVE', 'ENERGY', 'MOMENTUM'].every((s) => data.formulaLines.some((l) => l.includes(s))));
check('generation is 80', data.generation === 80);
check('grid is 40×40', data.gridWidth === 40 && data.gridHeight === 40);
check('densityPct is a finite number', Number.isFinite(data.densityPct));
check('energyMean is a finite number', Number.isFinite(data.energyMean));
check('params snapshot is a copy', data.params !== engine.params && data.params.birthLow === engine.params.birthLow);
check('date is pinned', data.date === '2026-08-18');
check('outcome is one of LIVE/RESONANT/QUIET', ['LIVE', 'RESONANT', 'QUIET'].includes(data.outcome));

const compact = generateCompactFormula(params);
check('compact formula is stable for same params', compact.join('\n') === generateCompactFormula(params).join('\n'));
const other = generateCompactFormula(getPresetParams(getPreset('stable-crystal')));
check('different presets produce different compact formulas', compact.join('\n') !== other.join('\n'));

check('classify QUIET when empty', classifyOutcome({ aliveCells: 0, alivePct: 0, resonance: 0.9 }) === 'QUIET');
check('classify RESONANT when hot', classifyOutcome({ aliveCells: 100, alivePct: 20, resonance: 0.94 }) === 'RESONANT');
check('classify LIVE otherwise', classifyOutcome({ aliveCells: 100, alivePct: 20, resonance: 0.4 }) === 'LIVE');

const svg = generateShareCardSVG(data);
check('svg is 1200×630', svg.includes('width="1200"') && svg.includes('height="630"'));
check('svg features the formula', svg.includes('RULE FORMULA') && svg.includes('BIRTH'));
check('svg shows field stats', svg.includes('DENSITY') && svg.includes('ENERGY') && svg.includes('MOMENTUM') && svg.includes('RESONANCE'));
check('svg shows product name', svg.includes('HEX AUTOMATON'));
check('svg includes the public host', svg.includes('karx.github.io/hex-automaton-explore'));
check('svg includes the date', svg.includes('2026-08-18'));

const dirty = buildCardData({
  engine,
  name: '<script>alert(1)</script>',
  provenance: { presetName: 'x&y', archetype: 'a<b' },
  date: '2026-08-18',
});
const dirtySvg = generateShareCardSVG(dirty);
check('user title is escaped', dirtySvg.includes('&lt;script&gt;') && !dirtySvg.includes('<script>alert'));
check('archetype ampersand is escaped', generateShareCardSVG({
  ...data,
  archetype: 'foo&bar',
  formulaLines: data.formulaLines,
}).includes('foo&amp;bar'));

const text = buildShareText(data);
check('share text names the run', text.includes('HEX AUTOMATON — Resonant Bloom'));
check('share text includes gen and outcome', text.includes('GEN 80') && text.includes(data.outcome));
check('share text includes a deep link', text.includes('https://karx.github.io/hex-automaton-explore/#s='));
check('share text includes birth line', text.includes(data.formulaLines[0]));

const token = encodeSharePayload(data);
const decoded = decodeSharePayload(token);
check('url token decodes', !!decoded);
check('decoded title matches', decoded.title === 'Resonant Bloom');
check('decoded generation matches', decoded.generation === 80);
check('decoded params.birthLow matches', Math.abs(decoded.params.birthLow - engine.params.birthLow) < 1e-4);
check('decoded sliders match', decoded.survivalPressure === preset.survivalPressure && decoded.momentumBias === preset.momentumBias);

const url = generateShareUrl(data);
const hash = url.slice(url.indexOf('#'));
check('generateShareUrl is a #s= link', hash.startsWith('#s='));
const fromHash = parseShareHash(hash);
check('parseShareHash round-trips', fromHash && fromHash.title === 'Resonant Bloom' && fromHash.generation === 80);
check('parseShareHash rejects empty', parseShareHash('') === null);
check('parseShareHash rejects junk', parseShareHash('#s=not-valid') === null);
check('decodeSharePayload rejects junk', decodeSharePayload('%%%') === null);

if (failed) {
  console.error(`\nverify-share-card: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nverify-share-card: all checks passed');
