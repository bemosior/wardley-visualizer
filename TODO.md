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

## Done so far

- [x] Phase 0 — Value Chain: generic User → User Need → Capability x3, drag Need into place, celebration.
- [x] Phase 0.5 — Refactor prep: mutable domain labels, decomposed `WardleyDemo` engine ops, swappable-mode `Panel`, `needCatalog.ts`, removed host-page toolbox duplication.
- [x] Phase 1 — Personalize the value chain: drag-then-form flow (need dropdown → User/Capability text fields), live relabeling of domain + rendered nodes, `celebrate(nodeId)` finale.
- [x] Phase 2 — Evolution: map backdrop, per-node evolution-axis drag + confirm (Need then Capability-1/2/3), live characteristics instrument-panel readout, stage-dependent flow-particle animation.
- [x] Finale — big celebration + `Panel.showRecap` with CTA link to LearnWardleyMapping.com.

## Phase 3 — Thinking with the map (not started; needs new abstractions)

Goal: Toolbox becomes a Q&A panel. Three questions in sequence, each anchored
to a capability, each answer rendered as a map annotation near that capability.

New pieces needed, not yet present:
- **Q&A Panel mode.** Another new `Panel` method (e.g. `showQuestion(...)`), parallel to `showField` but for the question→annotate flow described in the forecast (bias-check question, build/buy/outsource question, then a repeatable "random question" picker).
- **Question bank module.** `src/domain/questionBank.ts` or similar, shaped like `needCatalog.ts`'s `{id, label}` pattern — the forecast explicitly anticipated reusing that shape here.
- **Map annotation rendering.** Nothing currently renders free text near a node on the map. New `render.ts` factory (e.g. `createAnnotation(node, text)`) plus placement logic to avoid overlapping the node/backdrop from Phase 2.
- **"Random question, re-roll until you like it" UI.** A button in the Q&A panel mode that re-picks before the visitor commits an answer — straightforward once the Q&A mode and question bank exist.

This phase is entirely downstream of Phase 2's map backdrop existing (annotations are positioned relative to it), so don't start scoping it precisely until Phase 2 lands.

## Feedback-driven TODOs (from `feedback/` playtests, 2026-07-03)

Patterns pulled from summarized playtester notes in `feedback/*.txt` — see those
files for full context per reviewer. Ordered roughly by how many independent
testers hit the same thing (strongest signal first).

- [x] **Fix: need-topic content leaks across examples.** Selecting one topic
      (e.g. "fresh grocery delivery") surfaced suggestions/placeholders from a
      different topic (tea example: "commuter", "kettle", "kettle"). Hit
      independently by two testers (`pablogil.txt`, `velocirachael.txt`). Fixed
      by giving each `NeedOption` in `needCatalog.ts` its own `userPlaceholder`
      and `capabilityPlaceholders`, and wiring `userNeedDependency.ts`'s form
      steps to use the selected need's placeholders instead of the hardcoded
      tea-example ones.
- [x] **Add a visible "this is draggable" affordance.** Multiple testers
      (`jamesfairbairn.txt`, `joeltosi.txt`) didn't realize a node/capability
      could be dragged until they accidentally clicked it first — no visual
      cue (cursor, glow, handle) currently signals draggability before the
      first interaction. Addressed by the `wd-node--beckon` pulse (already
      wired to the toolbox's active drag slot for Phase 0/1, and to
      `beckonNode` calls before each Phase 2 evolution-drag step) plus the
      directional `wd-node-chevron` cues added alongside `runEvolutionDragStep`
      (`chevrons`, `unsubtle beckon`, `WIP to help focus during evolution
      dragging` commits).
- [x] **Clarify the opening frame before Phase 0/1 starts.** Five separate
      testers (`jamesfairbairn.txt`, `joeltosi.txt`, `joshkruszynski.txt`,
      `tomgeraghty.txt`, `pablogil.txt`) got lost before or during the
      capabilities step — unclear what a "value chain" is, who the demo is
      for, and what greyed-out elements mean. Strongest, most-repeated
      signal in the whole batch. Addressed by replacing the rhetorical
      "What is a Value Chain?" heading (`index.html`/`preview.html`'s
      `.wd-explanation` block) with copy that's visible immediately (not
      gated behind the Need-placement reveal): states there's no experience
      needed, gives an explicit first action ("drag the glowing circle onto
      the canvas"), and names the toolbox's two inactive `Panel` drag slots
      directly so their greyscale styling doesn't read as "wrong answers."
      The definition reveal (`#vc-answer`, shown via `onNeedPlaced`) is
      unchanged — it's still the payoff once the visitor completes the drag.
- [ ] **Scaffold the capabilities step.** Testers had no confidence in what
      counts as a capability or at what abstraction level
      (`pablogil.txt`, `joshkruszynski.txt`). `michaellindqvist.txt` proposes
      a concrete fill-in-the-blank scaffold ("I want / Because of / Depends
      on") that could be pre-filled as a worked example before the visitor
      free-types their own.
- [ ] **Reconsider single-layer value chain scope.** `jamesfairbairn.txt`:
      the grocery-delivery example's one-layer chain prompted an
      unproductive "do I depend on a truck? a farm? the cold chain?"
      recursion spiral that may work against the learning goal rather than
      for it. Worth deciding whether to bound the chain more explicitly or
      address the recursion question head-on in a later phase.
- [ ] **Audit assessment/self-check copy against arbitrary user input.**
      `pablogil.txt`: an invented example ("messaging with friends") landed
      in "deep commoditization" and produced a self-check answer that read
      as semantically wrong for that input — suggests the Phase 2/3
      assessment cues assume specific example content rather than being
      robust to whatever the visitor typed in Phase 1.
- [ ] **Accessibility pass on evolution-stage color coding.** `velocirachael.txt`:
      color bars used for evolution stages were not visible to her (high
      eye pressure/migraine, possibly compounded by monitor settings) —
      color-only encoding is a known contrast failure mode regardless of
      her specific condition; add higher-contrast or bordered/labeled
      alternatives.
- [ ] **Mobile drag/select gesture polish.** `rianporter.txt`: needed to
      zoom, and distinguishing "select" from "drag" took some learning on
      mobile — worth a dedicated mobile pass once desktop flow is settled.
- [ ] **Unresolved product tension — guided prompts vs. discovery.**
      `rianporter.txt` explicitly argues against more hand-holding
      ("people are smart"), while `tomgeraghty.txt`, `joshkruszynski.txt`,
      and `joeltosi.txt` all ask for more explicit prompts. Not a bug — a
      design call to make deliberately, not average away.
- [ ] **Flow animation change by evolutionary stage.**
      Commodity and product flow animations are perfect. Genesis currently
      "sputters" by having a more jagged, slow animation. Instead of that,
      let's have the animation path follow a random path in the general
      direction of the connected node (think baseball curveball). Conveys
      that an attempt is made to deliver value, but it's mostly missing.
      Custom-built is then a less unpredictable version of that; curves
      but hits most of the time.