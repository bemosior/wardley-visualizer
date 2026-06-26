# TODO — Tutorial Flow Plan

One continuous demo, not disconnected pieces. The visitor never leaves the
canvas; each phase builds on what the last phase left in place. This file is
written so a fresh Claude Code session can pick up any phase without having
read prior conversations — it names concrete files, exports, and types, not
just intent.

## How the engine is put together (read this before touching code)

Four layers, strict one-way dependency (lower layers know nothing about higher ones):

- **`src/engine/`** — generic SVG rendering/drag/animation. Knows about
  "nodes" and "connections", never about "User"/"Need"/"Capability".
  - `types.ts` — `DemoNode`, `DemoConnection`, `DemoConfig` (the engine's only contract).
  - `render.ts` — pure DOM/SVG element factories (`createNodeGroup`, `createConnectionLine`, `createTargetMarker`, `createFlowParticles`, `createFireworkShells`, `fitNodeLabel`). `NODE_RADIUS = 48`.
  - `drag.ts` — `attachDrag`: pointer-event drag-to-target with snap/return animation, optional `externalHandle` (drag picked up from a toolbox slot instead of the node itself).
  - `animate.ts` — `animateTo`, a generic tweened-position helper used by drag snap/return.
  - `WardleyDemo.ts` — the stateful scene. `WardleyDemo.mount(container, config, options?)` builds the whole scene once; after that, composable methods let a `Scenario` (see below) drive it step by step against the *same* mounted SVG:
    - `addNode(node)` — register + render one node.
    - `addConnection(conn)` — register + render one line (endpoints must already be added).
    - `relabelNode(id, label)` — update a node's text in place, refit font size.
    - `runDragStep(node, options)` — wire one drag-to-target interaction; on snap, calls `celebrateSnap` (lines activate, flow particles, firework burst, `options.onComplete`).
    - **Important gotcha:** the constructor auto-runs `runDragStep` for whichever node in `config.nodes` has `draggable: true` (at most one). If a phase has *no* drag step (Phase 1 doesn't), make sure no node in the initial `DemoConfig` is `draggable: true` — otherwise `mount` will wire a drag step you didn't ask for.
  - `panel.ts` — `Panel`, the toolbox abstraction. One `Panel` instance owns a container element and swaps between modes. **The toolbox must stay a constant height across every mode/phase** — hosts like `preview.html` size the toolbox card to its content, and a content jump (e.g. 3 drag slots vs. one form field) reads as a layout glitch. Every mode wraps its rendered content in a `wd-panel-content` div (`styles.ts`: `min-height: 360px`); a future instrument-panel (Phase 2) or Q&A (Phase 3) mode must reuse that same class rather than appending raw content, and if its content would exceed 360px, raise the shared constant rather than letting one mode silently grow past the others.
    - `showDragHandles(slots: PanelDragSlot[])` → `PanelDragHandle` (used by Phase 0).
    - `showField(field: PanelField)` → `Promise<string>`, resolves with the trimmed answer once the visitor submits (`type: "select"` or `type: "text"`). Wired into Phase 1's 5-step form sequence (`userNeedDependency.ts`).
  - `nextLink.ts` — `showNextLink(container: HTMLElement)` → `Promise<void>`, a standalone (non-Toolbox) helper that appends a small "Next" link into whatever container it's given and resolves once clicked. Used to gate a step transition behind a deliberate visitor action instead of a guessed timer. Deliberately not a `Panel` method — it renders into host-owned page regions outside the Toolbox (e.g. beneath a host's own explanation text), so it can't assume `.wd-panel`'s CSS variable scope; its `.wd-next-link` style (`styles.ts`) carries explicit fallback colors for that reason.
    - Not yet built: an "instrument panel" mode (live evolutionary-characteristics readout, Phase 2) and a "Q&A" mode (Phase 3). See those phases below for what they need.
  - `styles.ts` — `injectStylesOnce`, all CSS-in-JS class names (`wd-node`, `wd-panel-*`, etc.).

- **`src/domain/`** — Wardley Mapping vocabulary, framework-agnostic, no DOM.
  - `component.ts` — `Component { id, label, kind }`, `relabelComponent`.
  - `dependency.ts` — `Dependency { from, to }`.
  - `valueChain.ts` — `ValueChain { user, need, capabilities }` aggregate. `createValueChain(spec)` (throws if `capabilities.length === 0`), `valueChainComponents`, `valueChainDependencies`, `relabelUser`, `relabelNeed`, `relabelCapability`. **The chain is an immutable value** — every relabel function returns a new `ValueChain`; nothing mutates in place.
  - `needCatalog.ts` — `NEED_CATALOG: NeedOption[]` (`{id, label}`), the preset list for Phase 1's dropdown. Phase 3's question bank should follow the same `{id, label}`-ish shape.

- **`src/application/`** — translates domain → engine.
  - `valueChainLayout.ts` — `layoutValueChain(chain, options?)`: positions a `ValueChain` as a `DemoConfig` (User centered above the viewBox, Need below it, Capabilities spread evenly along a row). Currently always marks the Need as the one draggable node with a `start` position — that default is Phase-0-specific and will need an option to disable for Phase 1 (no dragging at all).

- **`src/demos/`** — one file per tutorial scenario, composing the layers above.
  - `userNeedDependency.ts` — exports `runValueChainScenario(options)`. **As of now this is still only Phase 0**: build the chain with generic placeholder labels, show one drag slot in the Panel, mount, done. It is *not* yet the multi-step Phase 1 flow (dropdown → 4 text fields → celebration) — don't assume the "Scenario" refactor mentioned in past TODO revisions already covers Phase 1's steps. It only removed the toolbox-toggling duplication that used to live in `index.html`/`preview.html`'s inline `<script>` blocks.

- **`src/index.ts`** — the public API surface (`WardleyDemo.demos.userNeedDependency`, etc.), consumed by `index.html` (Vite dev server, source) and `preview.html` (loads `dist/wardley-demo.js`, the built bundle — mirrors how the real host page `lwm-html` would embed this).

### Working conventions
- Test with `npm test` (Vitest + happy-dom). **Never run it inline in this session** — delegate to a subagent and have it report back condensed pass/fail output (see `[[feedback_test_execution]]` memory).
- `npm run dev` serves `index.html` for live iteration; `npm run build` then `npm run preview` exercises the built bundle through `preview.html`'s host-page-style embed.
- Every existing module under `domain/`, `application/`, `engine/`, `demos/` has a co-located `*.test.ts`. Keep that pattern — new modules get tests beside them, not in a separate tree.

## Phase 0 — Value Chain (done)

- [x] Generic User → User Need → Capability x3, drag Need into place, celebration.

## Phase 0.5 — Refactor prep (done)

- [x] Mutable domain labels (`relabelComponent`, `relabelUser`, `relabelNeed`, `relabelCapability`).
- [x] Decompose the engine's one-shot mount into composable ops (`addNode`, `addConnection`, `relabelNode`, `runDragStep` — see `WardleyDemo.ts` above).
- [x] `Panel` abstraction with swappable modes — drag-handle and form modes built; instrument-panel and Q&A modes deliberately deferred to Phase 2/3.
- [x] `needCatalog.ts` with `{id, label}` shape.
- [x] Removed the toolbox-toggling duplication between `index.html` and `preview.html` (both now just call `WardleyDemo.demos.userNeedDependency(...)`).

## Phase 1 — Personalize the value chain (done)

One continuous flow, not a replacement of Phase 0 — the drag step still
happens first, then the Toolbox continues into the 5-step form:

- [x] Drag the generic Need into place (unchanged Phase 0 step, same
      `panel.showDragHandles`/`runDragStep` wiring as before). A "Next" link
      (`showNextLink()`, `src/engine/nextLink.ts`) then renders into the
      host-supplied `nextControl` element — placed beneath the host's own
      explanation text in `index.html`/`preview.html` (`#vc-next`, a sibling
      of `#vc-answer` inside `.wd-explanation`), *not* inside the Toolbox —
      and the scenario waits for the visitor to click it before the Toolbox
      becomes a 5-step data-entry sequence: pick a need from `NEED_CATALOG` →
      type a User → type Capability 1 → 2 → 3 → celebrate. Both phases run
      against the same mounted `WardleyDemo` instance/canvas.
      `ValueChainScenarioOptions.nextControl` is required — any new host page
      embedding this scenario must supply that container.
- [x] `runValueChainScenario` (`src/demos/userNeedDependency.ts`) is now
      `async`: it `await`s a `Promise` wrapping the drag step's `onComplete`
      callback, then walks `panel.showField` calls in sequence, relabeling
      both the domain `ValueChain` (via `relabelNeed`/`relabelUser`/
      `relabelCapability`) and the rendered nodes (`demo.relabelNode`) as each
      answer comes in.
- [x] `WardleyDemo` gained a public `celebrate(nodeId)` method — activates all
      lines, charges every node, plays flow particles, and fires a firework
      burst centered on `nodeId`, without requiring a drag/snap. Used for the
      *second*, bigger celebration once personalization finishes (the drag
      step's own snap still triggers the existing `celebrateSnap` flourish).
      `celebrateSnap` was refactored to share the same `activateLines`/
      `spawnFlowParticles`/`fireworkAt` helpers.
- [x] A host-supplied `config` (e.g. `preview.html`'s hand-tuned geometry) must
      still mark the Need `draggable: true` with a `start`, and must use the
      seed `ValueChain`'s node ids (`user`, `need`, `dependency-1/2/3`) since
      relabeling is keyed by those ids — documented on
      `ValueChainScenarioOptions.config`. Fixed `preview.html`'s config, which
      had drifted (`capability-N` ids, stale drag `start`) from a prior phase.
- [x] Verified end-to-end in the dev server and in `preview.html`'s built-bundle
      embed: drag snaps and charges the chain, form steps relabel nodes live,
      final celebration re-charges everything and fires `onCelebrate`.

## Phase 2 — Evolution (entry gate, map backdrop, and drag-confirm for all four nodes done; full instrument-panel not started)

Goal: a Wardley map backdrop appears behind the value chain; User floats above
it, Need + Capabilities sit on it; visitor drags each of Need/Capability-1/2/3
left-right along its evolution axis one at a time, sees live characteristics
+ animation feedback, confirms, repeats, celebrates.

- [x] Phase 1 → Phase 2 transition gate: `runValueChainScenario`
      (`src/demos/userNeedDependency.ts`) reuses the same `nextControl`
      container as the Phase 0→1 gate — after the Phase 1 celebration, it
      shows a second `showNextLink()` link and waits for the visitor to
      click it before firing a new `onEvolutionReady` callback. Host pages
      (`index.html`, `preview.html`) use that callback to fade the entire
      `.wd-explanation` block (question, answer, next link) to invisible via
      a new `.wd-explanation--hidden` class, since Phase 2 is meant to be
      played without any explainer text competing for the visitor's
      attention. The Toolbox itself is *not* collapsed during this gate —
      `Panel` gained `showEmpty()` (renders a bare `.wd-panel-content`
      placeholder, same `min-height: 360px` as every other mode) so the
      Toolbox holds its full height, empty for now, ready for whatever
      Phase 2 content fills it next.
- [x] Map backdrop rendering: `render.ts`'s `createMapBackdrop(viewBox)` draws
      the four evolution-stage bands (Genesis/Custom-Built/Product/Commodity)
      with dividers and labels, styled in `styles.ts`. `WardleyDemo` renders
      it into a new `backdropLayer` (bottom of the z-order) via
      `showMapBackdrop(scale, targetHeightPx?)`, called from
      `runValueChainScenario` right after `onEvolutionReady`. Getting this
      right took two follow-up fixes beyond the initial render — both
      because resizing the canvas at the same moment the backdrop appears is
      easy to get subtly wrong in ways that move/resize the already-placed
      nodes (disorienting to a visitor mid-demo):
      - `captureScale()` snapshots the demo's current on-screen scale
        *before* the host expands the canvas; `showMapBackdrop` then widens
        (never shrinks) the viewBox to exactly fill the new width/height at
        that *same* scale, so every existing node keeps its exact pixel size
        and position — only new map area becomes visible alongside/beneath
        them. `targetHeightPx` (the toolbox's measured height) makes the map
        match the toolbox's height the same way.
      - The host pages (`index.html`, `preview.html`) had their own
        layout-shift bugs that caused a jump even with the scale math fixed:
        auto-centering on `.wd-canvas`/`.demo-row` re-centered the whole
        block the instant its width changed, and `.wd-explanation--hidden`
        clamped `max-width: 0` but not height, so its long text wrapped into
        a tall invisible column that (combined with `align-items: center`)
        pushed siblings down. Both host pages now anchor the canvas
        flush-left with a fixed top margin and clamp `max-height: 0` too, so
        nothing shifts when the explanation collapses.
- [x] Evolution-axis drag + confirm, wired for the Need node only (Capability-1/2/3
      repeat the same pattern in a follow-up — see below). New sibling function
      `attachAxisDrag` in `drag.ts` (a different interaction mode from
      `attachDrag`'s snap-to-point, not a parameterization of it, as previously
      planned here): free horizontal drag clamped to `[NODE_RADIUS, viewBoxWidth -
      NODE_RADIUS]`, no snap-back and no auto-commit on release — the node just
      stays wherever it's dropped, draggable again until an explicit `confirm()`.
      `WardleyDemo.runEvolutionDragStep(nodeId, options)` wires this onto an
      already-registered node and wraps live x into a stage label via
      `render.ts`'s new `stageLabelAt(x, viewBoxWidth)` (shares
      `EVOLUTION_STAGES`/band-width math with `createMapBackdrop`/`genesisCenterX`
      rather than duplicating it). `confirm()` re-charges the node, respawns its
      flow particles, and fires a firework at its final position as the
      "placement confirmed" cue. `runValueChainScenario`
      (`src/demos/userNeedDependency.ts`) wires it right after `demo.beckonNode`:
      `onPositionChange` calls a new `Panel.updatePlaceholderSubheading(text)` so
      the Toolbox's "Genesis" subheading updates live as the visitor drags; the
      first time the node is released (`onReadyToConfirm`), a confirm link
      appears reading "Confirm placement" — clicking it calls `confirm()` and
      resolves the scenario's promise. No instrument-panel/characteristics
      content yet (see below) — just the live stage name.
      **Fix:** this link was originally rendered via `showNextLink(nextControl,
      ...)`, same as the Phase 0→1 and Phase 1→2 gates — but `nextControl`
      lives inside the host's `.wd-explanation` block, which `onEvolutionReady`
      already hides for the rest of Phase 2, so the link silently rendered
      into an invisible container. `Panel` gained `confirmPlacement(label?)`,
      which appends the same `showNextLink` control into the Toolbox's own
      `.wd-panel-content` instead; `awaitEvolutionConfirm` now calls
      `panel.confirmPlacement()` and no longer takes a `nextControl` param.
- [x] Repeated the drag-confirm step for Capability-1/2/3. `userNeedDependency.ts`
      factors the wait-for-confirm wiring into a shared `awaitEvolutionConfirm`
      helper (used by the Need too) and, after the Need's `confirm()`, loops over
      `chain.capabilities`: `panel.showPlaceholder(capability.label, "Genesis")`,
      `demo.beckonNode`, `demo.slideToGenesis`, then awaits the same drag-confirm
      interaction. Once all three capabilities are confirmed, the Toolbox clears
      (`panel.showEmpty()`) and `demo.celebrateAll()` fires once more as the
      "all four placed" finale.

Still missing, not yet built:
- **Evolutionary-characteristics data.** No data module for this yet. Needs a small domain module (e.g. `src/domain/evolution.ts`) mapping evolution-stage (continuous x-position, or a discretized stage enum) → characteristics text, probably split by `ComponentKind` (`need` vs `capability`) per the forecast ("characteristics relevant to capabilities instead of user needs").
- **Live-updating "instrument panel" Panel mode.** `panel.ts`'s `Panel` class needs a new method, e.g. `showInstrumentPanel(...)`, that re-renders real characteristics text (once `domain/evolution.ts` exists) as drag position changes, rather than the simple stage-name label `updatePlaceholderSubheading` shows today. This is the mode `panel.ts`'s own doc comment already flags as deferred.
- **Stage-dependent flow animation.** The "genesis sputters / commodity flows smoothly" requirement means `createFlowParticles` (`render.ts`) and its CSS (`styles.ts`) need parameters for particle count/speed/regularity driven by evolution stage, not just the fixed `FLOW_PARTICLE_COUNT`/timing constants `WardleyDemo.ts` uses today.

## Phase 3 — Thinking with the map (not started; needs new abstractions)

Goal: Toolbox becomes a Q&A panel. Three questions in sequence, each anchored
to a capability, each answer rendered as a map annotation near that capability.

New pieces needed, not yet present:
- **Q&A Panel mode.** Another new `Panel` method (e.g. `showQuestion(...)`), parallel to `showField` but for the question→annotate flow described in the forecast (bias-check question, build/buy/outsource question, then a repeatable "random question" picker).
- **Question bank module.** `src/domain/questionBank.ts` or similar, shaped like `needCatalog.ts`'s `{id, label}` pattern — the forecast explicitly anticipated reusing that shape here.
- **Map annotation rendering.** Nothing currently renders free text near a node on the map. New `render.ts` factory (e.g. `createAnnotation(node, text)`) plus placement logic to avoid overlapping the node/backdrop from Phase 2.
- **"Random question, re-roll until you like it" UI.** A button in the Q&A panel mode that re-picks before the visitor commits an answer — straightforward once the Q&A mode and question bank exist.

This phase is entirely downstream of Phase 2's map backdrop existing (annotations are positioned relative to it), so don't start scoping it precisely until Phase 2 lands.

## Finale

- [ ] Big celebration.
- [ ] "Next" control scrolls the visitor to the next section of the page.
