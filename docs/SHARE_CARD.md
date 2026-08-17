# Share card — how a run becomes a receipt

The card is not a screenshot of the explorer. It is a **receipt of one
computed state**: the field you can only get by running N steps, plus the
numbers that describe that run.

There are two clocks. One runs in the background. One fires when you click.

Source: `src/share-data.js` (one assembler), `src/share-capture.js` (stills +
growth tape), `src/share-card.js` (1200×630 SVG), `src/share-text.js`,
`src/share-url.js`. Wired from `explorer.html`, `viewer3d.html`, and
the workbench. A `#s=` hash on the site root redirects into the workbench.

---

## 1. While the field is growing

The live loop already steps the engine. `GrowthTape` takes cheap stills
along the way — density only, small canvas, JPEG — so minting a card later
does not have to invent history.

It records:

- generation 0 (seed)
- every power of two (1, 2, 4, 8, 16, …)
- every 24 steps after the last capture

It stores up to 32 frames. When the buffer is full it drops the *most
redundant* interior frame in log-generation space — never the seed, never
the latest. The card then picks four of those frames on a log scale (see
[§3](#3-growth-slices-are-log-spaced)).

```
engine.step()
    │
    ├─ gen == 0 or power of 2 or +24 since last?
    │         yes → snapshotField (density only, 160×100 JPEG)
    │         no  → keep stepping
    │
    └─ buffer > 32? drop the interior frame closest to a neighbor
                    in log(1 + gen)
```

Restart, preset change, rule-kit import, or a `#s=` load **resets** the tape
and recaptures the new seed.

---

## 2. On click — one assembler, two weights

All four buttons call the same `buildCardData()`. Preview and Share ask for
the field. Copy text and Copy link do not (no canvas work).

```
Click
  │
  ├─ paint "Minting…" then wait one frame
  │
  └─ assembleCard({ withField })
         │
         └─ buildCardData()          ← reads engine arrays, never the DOM
                │
                ├─ sum density / energy / alive
                ├─ outcome:  alive ≈ 0 → QUIET
                │            resonance > 0.75 → RESONANT
                │            else → LIVE
                ├─ 4 compact formula lines
                ├─ COMPUTED N STEPS / "No closed form. No skip."
                │
                └─ withField?
                     yes → one NOW snapshot (density + energy glow)
                           + log-pick 4 frames from the tape
                     no  → fieldSnapshot = null
```

The explorer canvas is never read. The NOW snapshot is a second, offscreen
render of the same engine fields the GIF pipeline uses (`src/render.js`).

```
                    buildCardData()
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   generateShareCardSVG  buildShareText  generateShareUrl
          │               │               │
     1200×630 SVG    tweet-sized text   #s= token
          │               │               │
     Preview overlay      clipboard       clipboard
     or PNG file
```

---

## 3. Growth slices are log-spaced

An earlier version kept seed + the three most recent captures. At generation
1000 the strip looked like `SEED · G920 · G960 · G1000` — three twins of
*now*, no story of how it got there.

The strip is supposed to show **irreducibility**: you cannot skip from the
seed to the bloom. The timestamps therefore sit on a log scale from first
to last, inclusive:

```
target_i = t0 + expm1( log1p(t1 − t0) · i / (count − 1) )
```

For a run from generation 0 to 1000, four slots land at about:

```
i     u      target     meaning
0    0.00        0      seed
1    0.33       10      early structure
2    0.66       99      the field after it has become itself
3    1.00     1000      now
```

Each target picks the unused stored frame nearest that generation. The
shown strip is then sorted in time. Gaps **grow**:

```
linear (old)     SEED ──40── G960 ──40── G1000     all the action is in the last 5%
log (now)        SEED ──10── G10 ──90── G100 ──900── NOW
```

The same rule at generation 125 gives about `0, 5, 25, 125`. Short runs
with fewer than four stored frames pass through unchanged.

`selectAsymptoticFrames(frames, 4)` in `src/share-capture.js` is the pick.
`buildCardData()` is the only caller that decides what appears on the card.

---

## 4. How a field still is made

```
full torus at cellSize 3          crop to living cells           fit in the card slot
┌─────────────────────┐          ┌──────────────┐              ┌──────────────────┐
│                     │          │   ██▓▓██     │              │                  │
│         ░░          │   ──►    │ ██▓▓▓▓▓▓██   │     ──►      │    ██▓▓▓▓██      │
│        ░██░         │          │   ██▓▓██     │              │   ██▓▓▓▓▓▓██     │
│                     │          └──────────────┘              │    ██▓▓██        │
└─────────────────────┘   ignore empty torus                   └──────────────────┘
  70×70, mostly void      density ≥ 0.04 or |E| ≥ 0.12           max 560×340 JPEG
```

A cell counts as content if it has material or glow. Bounds get a 3-cell
pad, then the crop is scaled into the slot. The renderer does **not**
re-draw the whole torus at a huge cell size — that hitch is what made
Preview feel stuck.

| Snapshot | Layers | Size | When |
|---|---|---|---|
| Tape frame | Density only | 160×100 JPEG | Seed, powers of two, and every 24 gens |
| NOW field | Density + energy glow | 560×340 JPEG | Once, on Preview / Share |

Only `data:image/png` or `data:image/jpeg` is embedded. Anything else is dropped.

---

## 5. What the 1200×630 card actually is

```
1200 × 630
┌──────────────────────────────────────────────────────────────────────────┐
│ HEX AUTOMATON                          date                              │  80px
│ IRREDUCIBLE FIELD                      RESONANT / LIVE / QUIET           │
│                                        Resonant Bloom                    │
├──────────────────────────────┬───────────────────────────────────────────┤
│ THIS FIELD · GEN 1000 · 70×70│ COMPUTED                                  │
│ ┌──────────────────────────┐ │ 1,000                                     │
│ │                          │ │ STEPS                                     │
│ │   cropped living field   │ │ No closed form. No skip.                  │
│ │   (the UGC beauty)       │ │ This field exists because those steps ran.│
│ └──────────────────────────┘ │ ─────────────────────────────────────────│
│ GROWTH · HAD TO BE RUN       │ DENSITY      ████░░░░                     │
│ [SEED] [G10] [G99] [G1000]   │ ENERGY       ████░░░░                     │
│                              │ MOMENTUM     ░░░░░░░░                     │
│                              │ RESONANCE    ████████                     │
│                              │ RULE  BIRTH [2, 2.8]                      │
│                              │       P 0.50 · B 0.10                     │
├──────────────────────────────┴───────────────────────────────────────────┤
│ THE ONLY WAY TO KNOW STEP N+1 IS TO RUN IT     karx.github.io/…          │  70px
└──────────────────────────────────────────────────────────────────────────┘
        LEFT = artifact                         RIGHT = stats + claim
```

Left is the thing that has no shortcut. Right is why that number of steps
matters, plus just enough rule to restart.

---

## 6. Four outputs, one data object

The `#s=` link carries **rules + sliders + the receipt numbers**. It does
not carry pixels or canvas state. Opening it reseeds and grows a new
field. The JSON rule kit is still the only bit-identical resume.

| Channel | Has the picture? | Reconstructs the rules? | Reconstructs this canvas? |
|---|---|---|---|
| Card PNG | Yes — this field, this gen | No | No |
| Share text | No — names the steps | Via the URL in the text | No |
| `#s=` link | No | Yes — fresh seed | No |
| Rule-kit JSON | No | Yes | Yes, if “include state” is on |

---

## 7. The claim in one line

**Run the steps → keep a thin log-spaced tape of what appeared → on share,
crop the living structure into a receipt that says this state has no closed
form.**
