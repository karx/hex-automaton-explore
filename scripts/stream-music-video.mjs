// Stream stage: the orchestrator. Runs one continuous Engine, rendering
// video frames (existing renderFrame()/ParticleSystem) and driving the
// audio composer (src/music/compose.js) off the *same* running field, then
// hands the result to ffmpeg. Shaped like scripts/generate-gifs-v2.mjs
// (same Engine/renderFrame/PRESETS imports) but for a long, continuous run.
//
// Two ffmpeg passes, both well-worn single-pipe paths (no exotic multi-fd
// pipes): (1) video frames piped to an intermediate .mp4, audio PCM written
// straight to a temp file; (2) mux the two into the final file. If
// --sink=rtmp, a third pass pushes the finished file to the RTMP URL at
// real-time pace (`-re`) — RTMP is the lower-priority path for now; the
// file sink is what's exercised first end-to-end.
//
//   node scripts/stream-music-video.mjs --duration=5 --sink=file --out=scratch/smoke5.mp4
//   node scripts/stream-music-video.mjs --duration=900 --sink=rtmp --rtmp-url=rtmp://localhost:1935/live/fieldca
//   npm run music-video   # full 3600s default run
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { Engine } from '../src/engine.js';
import { renderFrame, computeLayout } from '../src/render.js';
import { ParticleSystem } from '../src/particles.js';
import { getPreset, getPresetParams, getPresetSeedFn } from '../src/presets.js';
import { getFavorite, getFavoriteSeedFn } from '../src/favorites.js';
import { normalizeSchema } from '../src/music/schema.js';
import { buildArrangement } from '../src/music/arrangement.js';
import { createComposer, SAMPLE_RATE } from '../src/music/compose.js';
import { generateLyrics, toLrc, toTranscript } from '../src/lyrics.js';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const m = /^--([a-zA-Z0-9-]+)=(.*)$/.exec(arg);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function resolveTarget(id) {
  try {
    const preset = getPreset(id);
    return { id: preset.id, name: preset.name, description: preset.description, params: getPresetParams(preset), seedFn: getPresetSeedFn(preset) };
  } catch { /* favorite or unknown */ }
  try {
    const fav = getFavorite(id);
    return { id: fav.id, name: fav.name, description: fav.description || fav.name, params: { ...fav.params }, seedFn: getFavoriteSeedFn(fav) };
  } catch {
    throw new Error(`Unknown library item: ${id}`);
  }
}

function requireFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version']);
  if (result.error || result.status !== 0) {
    throw new Error('ffmpeg not found on PATH. Install it and re-run (this pipeline shells out to it, same as this repo relies on Node/npm being present).');
  }
}

function writeAsync(stream, buffer) {
  return new Promise((resolve, reject) => {
    const ok = stream.write(buffer, (err) => { if (err) reject(err); });
    if (ok) resolve(); else stream.once('drain', resolve);
  });
}

function endAsync(stream) {
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.end(resolve);
  });
}

function waitExit(proc, label) {
  return new Promise((resolve, reject) => {
    if (proc.exitCode !== null) {
      return proc.exitCode === 0 ? resolve() : reject(new Error(`${label} exited with code ${proc.exitCode}`));
    }
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with code ${code}`))));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  requireFfmpeg();

  const schema = normalizeSchema({
    presetId: args.preset,
    durationSec: args.duration !== undefined ? Number(args.duration) : undefined,
    fps: args.fps !== undefined ? Number(args.fps) : undefined,
    grid: args.grid !== undefined ? Number(args.grid) : undefined,
    cellSize: args['cell-size'] !== undefined ? Number(args['cell-size']) : undefined,
    gensPerSecond: args['gens-per-second'] !== undefined ? Number(args['gens-per-second']) : undefined,
    tempo: args.tempo !== undefined ? Number(args.tempo) : undefined,
    seed: args.seed !== undefined ? Number(args.seed) : undefined,
    sink: {
      type: args.sink,
      path: args.out,
      url: args['rtmp-url'],
    },
  });
  const keepTemp = args['keep-temp'] === 'true';

  const target = resolveTarget(schema.presetId);
  console.log(`stream-music-video: preset=${target.name} duration=${schema.durationSec}s fps=${schema.fps} grid=${schema.grid} sink=${schema.sink.type}`);

  const engine = new Engine(schema.grid, schema.grid, target.params, target.seedFn);
  const rawLayout = computeLayout(schema.grid, schema.grid, schema.cellSize);
  // libx264 requires even width/height for yuv420p; computeLayout's hex bbox
  // is rarely even, so pad by at most 1px per axis (background-fill only,
  // hex positions/offsets are untouched).
  const layout = {
    ...rawLayout,
    canvasWidth: rawLayout.canvasWidth + (rawLayout.canvasWidth % 2),
    canvasHeight: rawLayout.canvasHeight + (rawLayout.canvasHeight % 2),
  };
  const canvas = createCanvas(layout.canvasWidth, layout.canvasHeight);
  const ctx = canvas.getContext('2d');
  const particles = new ParticleSystem({ maxParticles: 220 });

  const arrangement = buildArrangement(schema.durationSec);
  const composer = createComposer({ schema, arrangement });

  const outPath = schema.sink.path || 'music-video.mp4';
  const outDir = path.dirname(outPath);
  if (outDir && outDir !== '.' && !existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const base = outPath.replace(/\.[^./\\]+$/, '');
  const videoTmpPath = `${base}.video.tmp.mp4`;
  const audioTmpPath = `${base}.audio.tmp.pcm`;

  const videoProc = spawn('ffmpeg', [
    '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
    '-s', `${layout.canvasWidth}x${layout.canvasHeight}`, '-r', String(schema.fps),
    '-i', 'pipe:0',
    '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'veryfast',
    videoTmpPath,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  // If ffmpeg exits/crashes mid-stream, further writes to its stdin raise
  // EPIPE; swallow it here so the real failure surfaces via waitExit's exit
  // code check below instead of an unhandled 'error' crash.
  videoProc.stdin.on('error', () => {});

  const audioStream = createWriteStream(audioTmpPath);
  audioStream.on('error', () => {});

  const totalFrames = Math.ceil(schema.durationSec * schema.fps);
  const statSamples = [];
  let gensSoFar = 0;
  const t0 = Date.now();

  for (let f = 0; f < totalFrames; f++) {
    const frameEndSec = Math.min((f + 1) / schema.fps, schema.durationSec);
    const targetGen = Math.round(frameEndSec * schema.gensPerSecond);
    const stepsThisFrame = Math.max(0, targetGen - gensSoFar);
    for (let s = 0; s < stepsThisFrame; s++) {
      engine.step();
      particles.spawn(engine, layout);
      particles.update();
    }
    gensSoFar += stepsThisFrame;

    renderFrame(ctx, engine, layout, schema.cellSize, { ...schema.layers.video, particleSystem: particles });
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    await writeAsync(videoProc.stdin, Buffer.from(data.buffer, data.byteOffset, data.byteLength));

    const pcm = composer.advanceTo(frameEndSec, engine.lastStats);
    if (pcm.length) await writeAsync(audioStream, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));

    if (f % schema.fps === 0 || f === totalFrames - 1) {
      statSamples.push({ timeSec: frameEndSec, n: engine.n, lastStats: { ...engine.lastStats } });
    }
  }

  await endAsync(videoProc.stdin);
  await waitExit(videoProc, 'ffmpeg (video encode)');
  await endAsync(audioStream);

  console.log(`stream-music-video: rendered ${totalFrames} frames / ${gensSoFar} generations in ${((Date.now() - t0) / 1000).toFixed(1)}s, muxing…`);

  const muxProc = spawn('ffmpeg', [
    '-y', '-i', videoTmpPath,
    '-f', 'f32le', '-ar', String(SAMPLE_RATE), '-ac', '2', '-i', audioTmpPath,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outPath,
  ], { stdio: 'inherit' });
  await waitExit(muxProc, 'ffmpeg (mux)');

  if (!keepTemp) {
    try { unlinkSync(videoTmpPath); } catch { /* best-effort cleanup */ }
    try { unlinkSync(audioTmpPath); } catch { /* best-effort cleanup */ }
  }

  if (schema.sink.type === 'rtmp') {
    console.log(`stream-music-video: pushing ${outPath} to ${schema.sink.url} at real-time pace…`);
    const pushProc = spawn('ffmpeg', ['-re', '-i', outPath, '-c', 'copy', '-f', 'flv', schema.sink.url], { stdio: 'inherit' });
    await waitExit(pushProc, 'ffmpeg (rtmp push)');
  }

  const cues = generateLyrics(arrangement, target, statSamples);
  writeFileSync(`${base}.lrc`, toLrc(cues));
  writeFileSync(`${base}.txt`, toTranscript(cues));

  const final = engine.lastStats;
  console.log(`stream-music-video: done. ${outPath}, ${base}.lrc, ${base}.txt`);
  console.log(`  generations=${engine.generation} alive=${((final.aliveCells / engine.n) * 100).toFixed(1)}% resonance=${final.resonance.toFixed(3)} lyric cues=${cues.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
