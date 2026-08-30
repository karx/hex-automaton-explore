# Music video pipeline — living document

This file tracks the generative music-video pipeline as it evolves: current
architecture, current defaults *and why they're set where they are*, known
limitations, and a dated decision log. Update it in the same commit as any
change that alters defaults, architecture, or a tuning decision — the log at
the bottom is what keeps the *why* from getting lost, not just the *what*.

A generator that turns one continuous `Engine` run into a video with a full
generative musical arrangement, plus a lyrics transcript. Five stages:

```
Schema/Ontology -> Components -> Layers -> Render -> Stream
```

## Current defaults, and why

| Field | Default | Why |
|---|---|---|
| `presetId` | `pulsing-heart` | A genuine crash-and-regrow "heartbeat" — keeps supplying rhythmic variation for a full hour instead of settling flat. |
| `durationSec` | `3600` | The target: a full hour. |
| `fps` | `30` | Doubling to 60fps measured ~0.35x realtime (a hard call between "high fps" and "finishes in a reasonable time") — 30 was the practical ceiling. See Decision log, 2026-08-26. |
| `grid` | `60` | Matches the grid every preset was tuned/verified against (`scripts/verify-presets.mjs` etc.) — changing it changes simulation character, not just resolution. |
| `cellSize` | `12` | Resolution knob. `cellSize=3` (the original default) rendered a 469x275 canvas — tiny, reads as blurry on any modern screen. 12 renders ~1876x1098 and stayed close to real-time in profiling. |
| `gensPerSecond` | `15` | The field's visible "turn rate", independent of fps. The original default (4) meant the same generation held for ~6 frames in a row at 24fps — looked slow/static. |
| `tempo` | `96` BPM | Moderate, orchestral-leaning tempo; not re-tuned yet. |
| `seed` | `1` | Seeds the *composer's* own PRNG only — see Known limitations. |
| `layers.video.energyGlow` | `false` | By far the most expensive layer once the field densifies (profiled: dominant cost of a long render — see Decision log). Off by default; the picture reads cleanly without it. |
| `layers.audio.perc` | `false` | Kick/hat cut against a chill/ambient vibe, even after softening the attack and staggering its entrance — removed per direct feedback, not just quieted. See Decision log, 2026-08-27. |
| `sink.type` | `file` | RTMP is wired but lower-priority/less-tested — see Known limitations. |

Change any of these via `normalizeSchema(overrides)` or the matching CLI flag
(`--fps`, `--cell-size`, `--gens-per-second`, `--energy-glow=true`, ...).

## Schema/Ontology — `src/music/schema.js`

One config object describing an entire run (the table above). Same spirit as
`src/ontology.js`: defaults + a validated merge, not raw params scattered
across a script. `normalizeSchema(overrides)` fills in `DEFAULT_SCHEMA` and
clamps/validates — including dropping explicit `undefined` override keys so
a CLI wrapper that always builds a full object literal can't accidentally
clobber a default (see Decision log). Swapping this object (different
preset/tempo/seed/enabled layers) is what makes this a *generator* rather
than one fixed show — see `scripts/verify-schema.mjs`.

## Components — `src/music/components/`

Smallest reusable, dependency-free primitives:
- `theory.js` — note/frequency math, the default scale (A natural minor)
  and chord voicings (`i · VI · VII · iv`).
- `synth.js` — an ADSR envelope and a one-pole low-pass filter. (Raw
  oscillator waveforms used to live here; every tonal layer now reads a
  wavetable instead — see below.)
- `wavetable.js` — a small self-contained "sample set": band-limited
  single-cycle wavetables for pad/lead/bass (additive harmonic sums with a
  smooth taper, built once, read via interpolated lookup) and pre-baked
  one-shot kick/hat samples (their envelope and noise-shaping rendered
  once). This is what "real samples" means here — no external audio assets,
  generated from pure math, but played back like a sampler rather than
  computed fresh (and aliasing) every sample.
- `groove.js` — the rhythmic/melodic vocabulary: named 16-step kick/hat/bass
  patterns, and four 2-bar lead motifs (with rests baked in). A section's
  dynamics pick which pattern/motif fits; the field only biases velocity,
  variation, and the occasional passing tone — it does not independently
  decide whether each tick fires. See Decision log, 2026-08-26 (human taste).
- `rng.js` — a seeded PRNG (mulberry32) so the composer's own randomness is
  reproducible for a given stats stream + seed. Independent of the
  `Engine`'s own use of `Math.random()` in seeding (a separate, pre-existing
  gap — see `docs/EXPLORATIONS.md`, "Still open").

## Layers

- Audio — `src/music/layers/{perc,bass,pad,lead}.js`. Each exposes
  `{ id, isActive(section), schedule(ctx), synthesize(voice, tSinceStart) }`.
  `schedule()` runs once per 16th-note tick, reads the current groove
  pattern/motif, and lets the field's live `lastStats` (density, energy,
  resonance, momentum coherence, leak directionality) bias velocity, pan,
  timbre, and the occasional harmonic variation.
- Video — the existing `renderDensityLayer` / `renderEnergyGlowLayer` /
  `renderMomentumArrowsLayer` / `ParticleSystem` in `src/render.js` +
  `src/particles.js` already follow this exact per-layer pattern; reused
  as-is, toggled from `schema.layers.video`.

## Render

- Audio: `src/music/arrangement.js` builds the fixed "planned show" — a
  repeating ~7-minute macro-cycle (Intro → Build → Theme → Bridge → Climax
  → Release), replayed enough times to fill the run and clipped to land
  exactly on the requested duration. This is what makes the piece a
  satisfying listen *every run*, independent of what the field does.
  `src/music/compose.js`'s `createComposer()` walks a fixed tempo/16th-note
  clock across it. Per tick it:
  1. picks the current section's groove pattern/motif and chord,
  2. applies a beat-accent curve and humanized micro-timing (on-beat notes
     land a touch late, off-beat a touch early, plus a few ms of jitter —
     see Decision log),
  3. fades a layer in/out over ~3s around section boundaries instead of
     hard-cutting it on/off,
  4. mixes every sounding voice through a master bus (warmth low-pass, two
     cascaded allpass diffusers per channel for stereo glue, a soft
     limiter).
  Same stats sequence + seed ⇒ byte-identical output (`scripts/verify-composer.mjs`).
- Video: the existing `renderFrame()` — unchanged.
- Lyrics: `src/lyrics.js` — `generateLyrics()` returns timed cues named
  from the arrangement's sections and the running preset's own name/
  description (`src/presets.js`), plus milestone lines when resonance or
  alive-fraction cross a threshold. `toLrc()`/`toTranscript()` serialize.

## Stream — `scripts/stream-music-video.mjs`

The orchestrator, shaped like `scripts/generate-gifs-v2.mjs` (same
`Engine`/`renderFrame`/`PRESETS` imports) but driving one continuous run.
Two ffmpeg passes:

1. Video frames are piped to ffmpeg as they're rendered (`rawvideo`/`rgba`
   → an intermediate H.264 .mp4); audio PCM from the composer is written
   straight to a temp `.pcm` file alongside it.
2. Once the run finishes, a second ffmpeg pass muxes the two into the
   final file (`-c:v copy -c:a aac`).

If `--sink=rtmp`, a third pass pushes the finished file to the RTMP URL at
real-time pace (`ffmpeg -re -i <file> -c copy -f flv <url>`). **RTMP is the
lower-priority path for now** — this "render then push" approach was chosen
over a live dual-pipe ffmpeg process specifically to avoid Windows-specific
risk around arbitrary extra file-descriptor pipes; a true live low-latency
pipeline (frames and audio muxed into the RTMP push as they're produced,
no intermediate file) is the natural next step once there's a real ingest
endpoint to target.

### CLI flags

```
node scripts/stream-music-video.mjs \
  --preset=pulsing-heart --duration=3600 --fps=30 --grid=60 --cell-size=12 \
  --gens-per-second=15 --tempo=96 --seed=1 \
  --sink=file --out=music-video.mp4
  # or: --sink=rtmp --rtmp-url=rtmp://localhost:1935/live/fieldca
```

`npm run music-video` runs the full default (3600s) file-sink render.
Neither this script nor ffmpeg is required by `npm test` — the CI runner
has neither, so the test suite exercises the pure schema/theory/wavetable/
groove/arrangement/composer/lyrics logic only (`scripts/verify-{schema,
music-theory,wavetable,groove,arrangement,composer,lyrics}.mjs`).

### Local RTMP receiver

No RTMP server exists in this repo's toolchain — `npm run rtmp-server`
starts one via Docker ([mediamtx](https://github.com/bluenviron/mediamtx)),
rather than adding a native dependency to the JS project:

```
npm run rtmp-server
node scripts/stream-music-video.mjs --duration=30 --sink=rtmp
ffplay rtmp://localhost:1935/live/fieldca          # or:
# http://localhost:8888/live/fieldca/index.m3u8    (HLS, in a browser)
```

### Staged rollout

The same code path handles every stage — only `--duration`/`--sink` change:

1. `--duration=5 --sink=file` — fastest correctness check, no receiver needed.
2. `--duration=5` (or `=30`) `--sink=rtmp` — confirms the receiver connects
   and the stream is watchable.
3. `--duration=900` — confirms the arrangement's macro-cycle repeats with
   audible variation over a longer run.
4. `--duration=3600` (or `npm run music-video`) — the full run.

## Known limitations

- **RTMP is wired but under-tested.** No local mediamtx receiver has
  actually been exercised yet (Docker is available, `npm run rtmp-server`
  is set up, but the push path hasn't been run end-to-end).
- **The `Engine`'s own seeding isn't reproducible.** `src/seeds.js` and
  parts of `src/engine.js` use unseeded `Math.random()` — a pre-existing
  gap (`docs/EXPLORATIONS.md`, "Still open"), not something this pipeline
  introduced. `schema.seed` only makes the *composer's* choices
  reproducible for a given stats stream; the field itself varies run to run.
- **On-canvas lyric overlay.** `generateLyrics()`'s cues are timed and
  ready to drive a caption layer during `renderFrame()`, but nothing burns
  them into the video yet — output today is a `.lrc`/`.txt` transcript
  sidecar only.
- **Spoken/sung vocals.** No TTS or vocal-synthesis dependency exists in
  this project; the transcript is text only.
- **A full 3600s run has not been completed end-to-end in this environment**
  (tool-level execution windows here cap out well under an hour); the
  longest completed validation so far is a 3-minute run. `npm run
  music-video` run directly by a person, outside those constraints, is the
  way to actually produce the full hour.

## Decision log

**2026-08-26 — initial pipeline.** Built the five-stage architecture above
from scratch (no prior audio/video code existed). Chose a single sustained
preset for the whole hour (not a medley of movements), a fixed "planned
show" arrangement arc with the field seeding texture within it (not a plain
ambient drone), and a transcript-only lyrics output. `ffmpeg` confirmed
available; RTMP output planned but explicitly deprioritized behind a
working file sink.

**2026-08-26 — schema bug found via the CLI.** `normalizeSchema`'s
top-level and `sink` merges did `{ ...DEFAULT_SCHEMA, ...overrides }`
directly; the CLI always builds a full overrides object (including
`undefined` for flags the user didn't pass), and object spread copies
`undefined`-valued keys, silently clobbering the default. Fixed by
stripping `undefined` keys before merging; regression-tested in
`verify-schema.mjs`.

**2026-08-26 — renderer performance profiled.** A 900s render appeared to
degrade from 43x realtime to under 1x over its first ~7 minutes. Profiling
(`step`/`render`/`compose` timing split) showed `renderEnergyGlowLayer`'s
per-cell radial gradients — not the composer, not the CA step — as the
dominant and rapidly-growing cost as the field's alive-fraction climbed
(consistent with `src/render.js`'s own prior profiling notes). Disabling
`energyGlow` alone roughly halved a comparable render's wall time.

**2026-08-26 — music quality: "not working in terms of human taste".**
The original composer treated every layer as independent per-tick coin
flips (fire probability biased by field stats). This reads as arrhythmic
noodling no matter how the probabilities are tuned — there's no pulse, no
phrase. Researched groove-based production practice (drum-machine step
patterns, groove-quantize/humanization techniques) and Suno's public
architecture notes (a trained multi-model deep-learning system — not
something a from-scratch procedural generator can replicate, but confirms
current music-AI SOTA is model-based, not rule-based). Rewrote perc/bass to
play named 16-step patterns and lead to play one of four pre-composed 2-bar
motifs per phrase; added humanized micro-timing (on-beat late, off-beat
early, small jitter), a beat-accent curve, and a master bus (warmth filter,
stereo diffusion, softer limiter) for glue. Field stats now bias *which*
pattern/motif and how hard it hits, not *whether* a tick fires.

**2026-08-26 — real samples instead of live oscillators.** Raw
`sawWave()`/`triangleWave()` computed fresh every sample alias and sound
buzzy; live per-hit noise for percussion is jittery. Replaced with
`components/wavetable.js`: band-limited wavetables (additive harmonic sums,
built once, read via interpolation) for pad/lead/bass, and pre-baked
one-shot kick/hat samples. Deliberately used fixed internal seeds for the
sample-*building* noise (not the run seed) — a sample is a fixed asset;
only triggering should vary by run.

**2026-08-26 — video was blurry and slow.** `cellSize=3` rendered a
469x275 canvas (tiny → looks blurry on any screen after scaling to fit a
player) and `gensPerSecond=4` at 24fps meant the same generation held for
~6 frames in a row (looks static). Profiled several (fps, gensPerSecond,
cellSize) combinations after the energyGlow fix freed up a large compute
budget: cellSize=12/fps=30/gensPerSecond=15 renders a sharp ~1876x1098
frame and stayed close to real-time even in the expensive ~60%-alive
regime. Tried fps=60 too — dropped to ~0.35x realtime (a full hour would
take ~3 hours to render), so 30fps was kept as the practical ceiling rather
than chasing "higher is better" past the point of being usable.

**2026-08-27 — a specific hit was flagged as sharp.** A listener flagged a
"sharp pulse" around 2:00 in a sample render. Traced it to the exact moment
`Build` hands off to `Theme` — the first point in the whole run where
`perc` and `lead` turn on at all, both starting their fade-in at the same
instant, and the baked kick/hat samples had zero attack (full amplitude at
sample 0, a real digital click). Fixed both: added a few ms of attack ramp
to the drum samples, and staggered layer entrances (`LAYER_FADE` in
`compose.js` — perc now waits 1.5s and takes 6s to fade in, lead waits 2.5s
and takes 4.5s, instead of everyone using the same flat 3s). On listening
to the fixed version, the feedback was that the kick/hat itself — not just
its entrance — didn't belong: "no good for a chill vibe." Set
`layers.audio.perc` to `false` by default rather than continuing to tune
it. The layer/pattern code is untouched and still reachable via
`--layers.audio.perc=true` — this was a taste call about the default, not
a retraction of the groove-pattern approach for whichever layers *are* on.
