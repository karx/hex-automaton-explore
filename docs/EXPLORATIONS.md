# Explorations — IA, usability, and playground patterns

Working notes. The site root is now a reading + live-field landing
(`index.html`) that jumps to Library or Workbench. The classic 2D
instrument lives at `explorer.html`. `viewer3d.html` and
`langtons-ant.html` stay as sibling cameras. Pages under `explorations/`
are the feature views that won that IA.

**Register:** A (financial terminal). This is a data-dense visualization
tool whose *content is the UI*. First paint should still invite — see
Watch — but the grammar is orange / amber / yellow / cyan, monospace,
canvas-first. Do not mix Register B CRT green into the playground.

**Live sketches**

| Page | Pattern |
|---|---|
| [`index.html`](../index.html) | **Site landing** — reading overlay on a live Resonant Bloom; CTAs to Library / Workbench. `#s=` on root redirects into the workbench. |
| [`explorations/index.html`](../explorations/index.html) | Hub / catalogue of the sketches |
| [`explorations/library.html`](../explorations/library.html) | Browse before you run — **static HTML**, regenerate with `npm run library` |
| [`explorations/watch.html`](../explorations/watch.html) | Redirects into the workbench in Watch mode (same field, no remount) |
| [`explorations/workbench.html`](../explorations/workbench.html) | Winner: Watch HUD + Steer (all advanced knobs) + Read + Leave |
| [`explorer.html`](../explorer.html) | Classic 2D instrument (preserved, not the homepage) |

---

## 1. Usability audit (current playground)

### What the product is for

Five jobs, in the order a new visitor actually hits them:

1. **See it become itself** — the README GIFs promised a living field.
2. **Steer it** — two sliders, maybe a click-seed.
3. **Read it** — density / energy / momentum, resonance, the formula.
4. **Leave with it** — share card (this run) or rule kit (exact resume).
5. **Compare cameras** — 2D layers vs 3D stack. Langton’s Ant is a
   *different* toy that shares hex math.

The current IA treats (1)–(4) as one infinite panel and (5) as three
websites.

### What works

- The field, when you can see it, is the product. Mobile-after-shell is
  honest: full-bleed canvas, panel off-stage.
- Two ontology sliders are the right control surface. Raw params belong
  behind a fold (they now start closed).
- Share card V2 names the real artifact: an irreducible computed field.
- Rule-kit JSON is the only bit-identical resume. That job is solved as
  a *file*, not as a *visit*.
- Status strip + Space/P keys are the start of a terminal grammar.

### What’s broken (severity)

| # | Finding | Why it hurts |
|---|---|---|
| U1 | **No first-run handshake.** Boot is instant blank-to-sim. | Kaaro ritual loading is missing. Visitor doesn’t know the field is *computing*. |
| U2 | **Preset is a `<select>`.** Character is a paragraph of prose. | People pick from the README GIFs. The live UI hides the pictures. |
| U3 | **Grow, read, leave, and kit share one scroll.** | Four jobs, one surface. Share is “near the top” now and still competes with meters, flow, grid, formula, export. |
| U4 | **2D / 3D / Ant are peer apps.** | 2D and 3D are cameras on one engine. Ant is a second product. The nav lies. |
| U5 | **No session breadcrumb.** | `Library › Resonant Bloom › gen 520` does not exist. Topbar says `2D`. That’s a camera, not a place. |
| U6 | **`#s=` opens generation 0.** | The card says “this field exists because those steps ran.” The link throws the steps away. |
| U7 | **Sans-serif body, cyan/indigo chrome.** | Breaks the kaaro monospace contract and Register A color grammar. Explorations use Register A; do not stealth-reskin production yet. |
| U8 | **Click-to-seed is a subtitle.** | First-time visitors don’t know the canvas is a tool. |
| U9 | **Formula and glossary are a second essay.** | Reading the rule set is a mode, not a footer. |
| U10 | **Desktop still shows the whole instrument at once.** | Mobile drawer was the right idea. Desktop never got the same progressive disclosure. |

### Cognitive model we should be building

```
Library (choose a seed / character)
  └─ Watch (the field computing)
       ├─ Steer   (pressure, bias, layers, click-seed)
       ├─ Read    (formula, meters, glossary)
       └─ Leave   (card, text, link, rule kit)
```

Breadcrumb = session memory: `HEX AUTOMATON › Resonant Bloom › WATCH · GEN 520`.

The canvas stays the anchor in Watch / Steer / Read / Leave. Only Library
is allowed to put the field in a thumbnail.

---

## 2. IA options (brainstorm)

### A — Three websites (current)

`index` / `viewer3d` / `langtons-ant`. Each is a full instrument.

- Honest about implementation (they *are* three pages).
- Forces a full reload to change camera.
- Duplicates chrome, share, kit, sliders.

**Verdict:** keep Ant as a sibling product. Stop treating 3D as a sibling
*app*.

### B — Cinema / Watch only

One full-bleed field, one preset, mint at the end. No sliders.

- Matches the GIF promise. Terrible as a playground.

**Verdict:** a *mode*, not the product. See Watch sketch.

### C — Library → Run

Catalogue of presets (stills/GIFs). Click enters the current explorer.

- Fixes U2. Does not fix U3 (the run surface is still a junk drawer).

**Verdict:** the right *front door*. Not sufficient alone.

### D — Workbench with a mode rail (recommended)

One shell. Left or top rail: `LIBRARY · WATCH · STEER · READ · LEAVE`.
Canvas always present except on Library. Right panel slides; its body
is the active mode. Status bar is the system voice. 2D/3D is a camera
toggle *inside* Watch/Steer, not a site.

```
┌ topbar: HEX AUTOMATON › Resonant Bloom › STEER ──────── 2D|3D ┐
│ rail │  canvas (always)              │  sliding panel        │
│ LIB  │                               │  mode-specific        │
│ WATCH│                               │                       │
│ STEER│                               │                       │
│ READ │                               │                       │
│ LEAVE│                               │                       │
└ status: GEN 520 · ALIVE 12% · RES 94% · SPACE PAUSE · ? HELP ┘
```

- One job visible. Context (the field) never leaves.
- Matches kaaro: canvas anchor, detail from the right, breadcrumb as memory.
- Ant stays a linked sibling (`HEX AUTOMATON › ANT`), not a rail item.

**Verdict:** this is the playground.

### E — Prompt / terminal

`> load resonant-bloom` `> step 500` `> mint`.

- On-brand for Register A, hostile to the visual job (U1).
- A `?` command list can live *inside* D. Not the shell.

---

## 3. Recommended interaction pattern

**Name:** canvas-first workbench.

**Register:** A.

**First paint:** Watch, not Steer. Boot handshake ~300ms
(`CONNECTING FIELD…`), then Resonant Bloom (or the `#s=` preset) running.
No panel open on mobile. Desktop: rail visible, Watch panel collapsed or
a thin caption only.

**Primary loop**

1. Library — pick a character (picture + one line).
2. Watch — let it compute. Gen number is the hero datum.
3. Steer only when the visitor reaches for sliders or clicks the field.
4. Read when they ask what a number *is*.
5. Leave when they have a field worth keeping.

**Keys (document in the status bar)**

| Key | Action |
|---|---|
| Space | Play / pause |
| 1–5 or L W S R E | Library / Watch / Steer / Read / Leave |
| [ ] | Previous / next preset |
| C | Camera 2D / 3D |
| M | Mint card |
| P | Toggle panel (mobile) |
| ? | Key list |
| Esc | Close panel / preview |

**Do not**

- Modal the field away to share (preview overlay is already a compromise;
  prefer a Leave-mode card preview in the rail).
- Put kit JSON on the Watch surface.
- Use a second accent. Interactive = orange. Values = yellow. Labels = amber.
- Invent a new page for every preset.

---

## 4. Feature-view briefs (what each POC proves)

### Library — `explorations/library.html`

**Question:** Can someone pick a field by *seeing* it?

Grid of authored **favorites** (exact rule kits, `?favorite=`) then the 14
presets. Every card uses a `gifs-v2/` thumb (`npm run gifs`). Clicking a
card goes to Watch.

**Pulsating Full** is the first favorite — a hand-tuned Resonant Bloom kit
(wide birth window, filled ~56% field that breathes) loaded as resolved
params, not as the stock slider pair.

**Pass if:** a stranger can choose Resonant Bloom vs Pulsing Heart without
reading a paragraph.

### Watch — now a *mode* of the workbench

`watch.html` redirects to `workbench.html?mode=watch`. The cinema HUD
(generation hero, mint, no sliders) lives on the same page as Steer.
Switching Watch → Steer slides the drawer; the engine, tape, and canvas
keep running. That was the jump that felt broken when they were two pages.

**Pass if:** Steer does not flash a boot screen or reset generation.

### Workbench — `explorations/workbench.html`

**Question:** Can four jobs share one shell without a junk drawer?

Rail + sliding right panel. Canvas persists. Steer shows ontology sliders
**and** every raw engine parameter (birth / survival / energy / momentum),
layers, particles, and grid. Leave mints a card with the growth tape
(log-spaced stills captured while watching), copies share text / link,
and exports or imports a rule kit (Copy JSON / Download / Load — same
contract as the live 2D explorer, including optional canvas state).

**Pass if:** switching Watch → Steer does not remount the field; a mint
after ~80 gens shows SEED plus later frames, not a single NOW crop.

### Parity with live `explorer.html`

| Live 2D | Workbench |
|---|---|
| Preset select + description + Restart | Steer: select + desc + Restart; `[` `]` cycle |
| Pressure / Bias | Steer |
| Layers + particles | Steer |
| Grid 30–120 / cell 4–16 | Steer (same range) |
| Raw parameters | Steer (all grouped sliders) |
| Field meters + resonance | Read |
| Interaction flow | Read |
| Metrics (FPS, alive, leak) | Read |
| Formula + copy | Read |
| Preview / Share card / Copy text / Copy link | Leave |
| Export kit (copy + download, optional state) | Steer → Advanced · rule kit |
| Import kit (file + paste) | Steer → Advanced · rule kit |
| `#s=` hash load | Yes |
| Click-to-seed | Yes (opens Steer) |

### Hub — `explorations/index.html`

Index of the sketches plus a short read of this doc. Not a fourth pattern.

---

## 5. Still open

- Seeded PRNG + `#s=` fast-forward (highest-impact *engine* follow-up;
  the card still opens generation 0).
- Reskinning the frozen 2D instrument (`explorer.html`) to Register A —
  or retiring it from nav once workbench is enough.
- Merging Langton’s Ant into the rail.
- Wiring a Playwright smoke (landing seed + library → workbench crumb)
  into CI. `serve.json` disables clean URLs so `?preset=` survives locally.

The homepage *is* the reading landing now. Workbench / Library are the
primary jumps. `explorer.html` is frozen: no new features; port them to
the workbench.

---

## 6. Audit → sketch map

| Finding | Addressed in |
|---|---|
| U1 no handshake | Watch boot |
| U2 preset picker | Library |
| U3 junk drawer | Workbench modes |
| U4 fake peer apps | Workbench camera slot (labeled); Ant stays sibling |
| U5 no breadcrumb | All three sketches |
| U6 share link is gen 0 | Still open (engine) |
| U8 seed affordance | Watch caption + Workbench Steer |
| U9 formula as essay | Workbench Read |
| U10 desktop disclosure | Workbench + Watch |

---

## 7. How to look at the POCs

Open `/` for the landing, then Library or Workbench. The exploration hub
is still at `explorations/index.html`. Library and Workbench are in
`sitemap.xml`; the hub itself is not.
