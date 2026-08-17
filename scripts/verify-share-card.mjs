import { createCanvas } from '@napi-rs/canvas';
import { Engine } from '../src/engine.js';
import { getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { generateCompactFormula } from '../src/formula.js';
import { buildCardData, classifyOutcome, irreducibleCaption, formatSteps } from '../src/share-data.js';
import { generateShareCardSVG } from '../src/share-card.js';
import { buildShareText } from '../src/share-text.js';
import { encodeSharePayload, decodeSharePayload, parseShareHash, generateShareUrl } from '../src/share-url.js';
import { GrowthTape, snapshotField, isSafeImage } from '../src/share-capture.js';

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`);
  if (!ok) failed += 1;
}

const preset = getPreset('resonant-bloom');
const params = getPresetParams(preset);
const engine = new Engine(40, 40, params, getPresetSeedFn(preset));
const canvasFactory = (w, h) => createCanvas(w, h);
const tape = new GrowthTape({ maxFrames: 4, every: 20, canvasFactory });
tape.capture(engine);
for (let i = 0; i < 80; i++) {
  engine.step();
  tape.maybeCapture(engine);
}
tape.capture(engine);

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
  growthFrames: tape.frames,
  canvasFactory,
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

check('field snapshot is an image data url', isSafeImage(data.fieldSnapshot));
const noSnap = buildCardData({
  engine,
  name: 'Resonant Bloom',
  provenance: { presetId: preset.id },
  date: '2026-08-18',
  fieldSnapshot: null,
});
check('fieldSnapshot null skips capture', noSnap.fieldSnapshot === null);
check('growth tape kept seed + later frames', tape.frames.length >= 2 && tape.frames[0].generation === 0 && tape.frames[tape.frames.length - 1].generation === 80);
check('irreducible caption names the step count', data.irreducible.kicker === 'COMPUTED' && data.irreducible.steps === '80' && data.irreducible.unit === 'STEPS');
check('formatSteps groups thousands', formatSteps(10247) === '10,247');
check('irreducible seed copy differs', irreducibleCaption(0).lines[0].includes('Seed only'));

const snap = snapshotField(engine, { cellSize: 3, canvasFactory });
check('snapshotField returns a png', isSafeImage(snap));

const svg = generateShareCardSVG(data);
check('svg is 1200×630', svg.includes('width="1200"') && svg.includes('height="630"'));
check('svg features the grown field', svg.includes('THIS FIELD') && /data:image\/(png|jpeg);base64,/.test(svg));
check('svg states irreducibility', svg.includes('IRREDUCIBLE FIELD') && svg.includes('COMPUTED') && svg.includes('THE ONLY WAY TO KNOW STEP N+1 IS TO RUN IT'));
check('svg shows compact formula', svg.includes('BIRTH') && svg.includes('SURVIVE'));
check('svg shows field stats', svg.includes('DENSITY') && svg.includes('ENERGY') && svg.includes('MOMENTUM') && svg.includes('RESONANCE'));
check('svg shows product name', svg.includes('HEX AUTOMATON'));
check('svg includes the public host', svg.includes('karx.github.io/hex-automaton-explore'));
check('svg includes the date', svg.includes('2026-08-18'));
check('svg growth strip present', svg.includes('GROWTH · HAD TO BE RUN') && svg.includes('SEED'));

const dirty = buildCardData({
  engine,
  name: '<script>alert(1)</script>',
  provenance: { presetName: 'x&y', archetype: 'a<b' },
  date: '2026-08-18',
  fieldSnapshot: null,
});
const dirtySvg = generateShareCardSVG(dirty);
check('user title is escaped', dirtySvg.includes('&lt;script&gt;') && !dirtySvg.includes('<script>alert'));
check('title ampersand is escaped', generateShareCardSVG({
  ...data,
  title: 'foo&bar',
  fieldSnapshot: null,
  growthFrames: [],
}).includes('foo&amp;bar'));

const text = buildShareText(data);
check('share text names the run', text.includes('HEX AUTOMATON — Resonant Bloom'));
check('share text includes computed steps', text.includes('COMPUTED 80 STEPS') && text.includes(data.outcome));
check('share text includes irreducibility', text.includes('No closed form'));
check('share text includes a deep link', text.includes('https://karx.github.io/hex-automaton-explore/#s='));
check('share text includes birth line', text.includes(data.formulaLines[0]));

const noImg = generateShareCardSVG({ ...data, fieldSnapshot: 'javascript:alert(1)', growthFrames: [{ generation: 0, image: 'http://evil.example/x.png' }] });
check('unsafe images are not embedded', !noImg.includes('javascript:') && !noImg.includes('http://evil.example'));

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
