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
    - **Important gotcha:** the constructor auto-runs `runDragStep` for whichever node in `config.nodes` has `draggable: true` (at most one). If a phase has *no* drag step (Phase 10 doesn't), make sure no node in the initial `DemoConfig` is `draggable: true` — otherwise `mount` will wire a drag step you didn't ask for.
  - `panel.ts` — `Panel`, the mode-swapping content renderer. One `Panel` instance owns a container element and swaps between modes; the mascot (`mascot.ts`) composes the only `Panel` instance now in use, pointed at its speech bubble, and is the sole renderer of every mode below (there is no sidebar Toolbox anymore — the mascot guides the whole scenario, from Phase 0's drag affordance through the closing recap). Every mode wraps its rendered content in a `wd-panel-content` div; the base rule reserves `min-height: 360px` (`styles.ts`: `PANEL_CONTENT_MIN_HEIGHT`, also passed to `showMapBackdrop` to size the map's reserved height), but `.wd-mascot-bubble .wd-panel-content` overrides that to `min-height: 0` so the bubble hugs its content instead.
    - `showDragHandles(slots: PanelDragSlot[], intro?)` → `PanelDragHandle` (used by Phase 0; `intro` renders a heading/subheading above the slot row).
    - `showField(field: PanelField)` → `Promise<string>`, resolves with the trimmed answer once the visitor submits (`type: "select"` or `type: "text"`). Wired into Phase 10's 5-step form sequence (`userNeedDependency.ts`).
  - `nextLink.ts` — `showNextLink(container: HTMLElement)` → `Promise<void>`, a standalone (non-`Panel`) helper that appends a small "Next" link into whatever container it's given and resolves once clicked. Used to gate a step transition behind a deliberate visitor action instead of a guessed timer. Deliberately not a `Panel` method — it renders into host-owned page regions (e.g. beneath a host's own explanation text), so it can't assume `.wd-panel`'s CSS variable scope; its `.wd-next-link` style (`styles.ts`) carries explicit fallback colors for that reason.
    - Not yet built: an "instrument panel" mode (live evolutionary-characteristics readout, Phase 20) and a "Q&A" mode (Phase 30). See those phases below for what they need.
  - `styles.ts` — `injectStylesOnce`, all CSS-in-JS class names (`wd-node`, `wd-panel-*`, etc.).

- **`src/domain/`** — Wardley Mapping vocabulary, framework-agnostic, no DOM.
  - `component.ts` — `Component { id, label, kind }`, `relabelComponent`.
  - `dependency.ts` — `Dependency { from, to }`.
  - `valueChain.ts` — `ValueChain { user, need, capabilities }` aggregate. `createValueChain(spec)` (throws if `capabilities.length === 0`), `valueChainComponents`, `valueChainDependencies`, `relabelUser`, `relabelNeed`, `relabelCapability`. **The chain is an immutable value** — every relabel function returns a new `ValueChain`; nothing mutates in place.
  - `needCatalog.ts` — `NEED_CATALOG: NeedOption[]` (`{id, label}`), the preset list for Phase 10's dropdown. Phase 30's question bank should follow the same `{id, label}`-ish shape.

- **`src/application/`** — translates domain → engine.
  - `valueChainLayout.ts` — `layoutValueChain(chain, options?)`: positions a `ValueChain` as a `DemoConfig` (User centered above the viewBox, Need below it, Capabilities spread evenly along a row). Currently always marks the Need as the one draggable node with a `start` position — that default is Phase-0-specific and will need an option to disable for Phase 10 (no dragging at all).

- **`src/demos/`** — one directory per tutorial scenario, composing the layers above.
  - `userNeedDependency/` — the full Phase 0 → Finale flow, split one file per phase, threaded by a
    shared `ScenarioContext` (`{ demo, mascot, chain, options }`):
    - `index.ts` — `ValueChainScenarioOptions`, `ScenarioContext`, and `runValueChainScenario(options)`, a thin sequencer that awaits each phase in turn and returns the final `WardleyDemo`. This is the file `src/index.ts` imports (module resolution finds `userNeedDependency/index.ts` from the same `"./demos/userNeedDependency"` specifier as before — no caller changes needed).
    - `phase0.ts` — seed the `ValueChain`, lay it out, mount the `Mascot` + `WardleyDemo`, drag the Need into place. Returns the initial `ScenarioContext`.
    - `phase5.ts` — between Phase 0 and Phase 10: shows the "You just made a Value Chain!"
      placeholder (moved here from `phase10.ts`), then walks the visitor through the chain node by
      node — User ("This is a user."), Need ("This is a user need."), a single Capability ("This is
      a capability.") — each gated behind its own "Next", before ensuring all three Capability nodes
      exist (Phase 0's config is allowed to render only one, e.g. `preview.html`'s host-embed config
      — this phase adds whichever are missing, spread left/right of whichever one is already there,
      connected to the Need), relabeling all three "Part A"/"Part B"/"Part C" by final left-to-right
      screen position, and explaining that a need is sometimes met by several parts adding up
      together, before handing off to Phase 7.
    - `phase7.ts` — a brief pause between Phase 5 and Phase 10 where the mascot steps back from
      the value chain into open canvas whitespace (`Mascot.moveToViewBoxPoint`, not anchored to any
      node) to introduce itself ("I'm Ben, by the way."), gated behind its own "Next", before
      handing off to Phase 10's form.
    - `phase10.ts` — the 5-step personalization form (user → need → 3 capabilities), relabeling both the domain chain and the rendered nodes as each answer comes in.
    - `phase20.ts` — the map backdrop and the evolution-axis drag/confirm loop (Need, then Capability-1/2/3); owns the private `awaitEvolutionConfirm` helper shared by that loop.
    - `phase30.ts` — walks `domain/conceptBank.ts`'s `CONCEPT_BANK` against candidate nodes on the map, gating each (concept, node) pairing behind a Yes/No/"Try something else" question before digging into the concept's deep-dive multiple-choice question and annotating the map; a "Done" option appears once 3 concepts have settled.
    - `finale.ts` — the closing recap + CTA link.
    - `index.test.ts` — end-to-end integration tests driving the whole scenario through `runValueChainScenario`; kept as one file (not split per phase) since most tests depend on state built up by earlier phases.

- **`src/index.ts`** — the public API surface (`WardleyDemo.demos.userNeedDependency`, etc.), consumed by `index.html` (Vite dev server, source) and `preview.html` (loads `dist/wardley-demo.js`, the built bundle — mirrors how the real host page `lwm-html` would embed this).

### Working conventions
- Test with `npm test` (Vitest + happy-dom). **Never run it inline in this session** — delegate to a subagent and have it report back condensed pass/fail output (see `[[feedback_test_execution]]` memory).
- `npm run dev` serves `index.html` for live iteration; `npm run build` then `npm run preview` exercises the built bundle through `preview.html`'s host-page-style embed.
- Every existing module under `domain/`, `application/`, `engine/`, `demos/` has a co-located `*.test.ts`. Keep that pattern — new modules get tests beside them, not in a separate tree.

Completed work has moved to [CHANGELOG.md](CHANGELOG.md) — this file only
tracks what's still open or actively planned.

## Feedback-driven TODOs (from `feedback/` playtests, 2026-07-03)

Open/deferred items only — completed items from this batch are in
[CHANGELOG.md](CHANGELOG.md). See `feedback/*.txt` for full reviewer context.

- [-] **Scaffold the capabilities step.** Testers had no confidence in what
      counts as a capability or at what abstraction level
      (`pablogil.txt`, `joshkruszynski.txt`). `michaellindqvist.txt` proposes
      a concrete fill-in-the-blank scaffold ("I want / Because of / Depends
      on") that could be pre-filled as a worked example before the visitor
      free-types their own.
- [-] **Reconsider single-layer value chain scope.** `jamesfairbairn.txt`:
      the grocery-delivery example's one-layer chain prompted an
      unproductive "do I depend on a truck? a farm? the cold chain?"
      recursion spiral that may work against the learning goal rather than
      for it. Worth deciding whether to bound the chain more explicitly or
      address the recursion question head-on in a later phase.
- [-] **Audit assessment/self-check copy against arbitrary user input.**
      `pablogil.txt`: an invented example ("messaging with friends") landed
      in "deep commoditization" and produced a self-check answer that read
      as semantically wrong for that input — suggests the Phase 20/30
      assessment cues assume specific example content rather than being
      robust to whatever the visitor typed in Phase 10.
- [ ] **Mobile drag/select gesture polish.** `rianporter.txt`: needed to
      zoom, and distinguishing "select" from "drag" took some learning on
      mobile — worth a dedicated mobile pass once desktop flow is settled.
- [-] **Unresolved product tension — guided prompts vs. discovery.**
      `rianporter.txt` explicitly argues against more hand-holding
      ("people are smart"), while `tomgeraghty.txt`, `joshkruszynski.txt`,
      and `joeltosi.txt` all ask for more explicit prompts. Not a bug — a
      design call to make deliberately, not average away. Note: extending the
      mascot to Phase 0/10 (see CHANGELOG.md) leans toward the more-guidance
      side of this tension, not something playtesters asked for by name — not
      resolved here, just flagged since it's now more load-bearing than before.

## Next: reusable foundation for ~150 embeddable exercises (planned 2026-07-11, not yet built)

The course needs up to ~150 situation-specific Wardley Mapping exercises, each
living standalone on its own lesson page as an embed. Today this repo
contains exactly **one** hand-built narrative demo
(`src/demos/userNeedDependency/`) — hardcoded to a single User→Need→Capability
chain, with mascot dialogue and control flow interleaved in the same phase
files. This section plans the refactor toward reusability, phased so any one
item can be picked up in a fresh session. Each phase is independently
landable — land Phase 1, verify, move on, rather than doing all of it in one
pass.

**Ground rules confirmed with Ben (2026-07-11):** the 150 exercises will be a
*mix* of short 1-3 step drills and fuller narratives; authoring will be
TS-first (engineers writing small files that call reusable functions, not a
JSON schema/interpreter — but keep the step vocabulary data-shaped enough to
bolt that on later); map *shapes will vary genuinely* (multi-chain, arbitrary
graphs, anti-pattern maps, comparisons, evolution-only drills), not just
parameterized copies of the existing chain. Given this repo's
no-premature-abstraction convention, build only what's needed to prove the
abstraction against 3 deliberately different validation exercises (Phase 6
below) — not a speculative do-everything framework up front.

**Audit finding, worth internalizing before touching code:** the `engine/`
layer (SVG rendering, drag, animation, `WardleyDemo`, `Panel`/`Mascot`) is
already close to fully generic — it knows about "nodes and connections," not
"Users and Needs." The real gaps are (a) two small leaks of domain vocabulary
into that supposedly-generic layer, (b) no domain/layout model for anything
but the one linear chain shape, and (c) no reusable step vocabulary — every
phase of the one existing demo is bespoke imperative code, so there's zero
proof today a second, differently-shaped exercise is even possible without a
rewrite. Phases 1-4 below close those three gaps in order; Phase 6 is the
proof.

- [ ] **Phase 1 — Fix two real layering leaks (no behavior change).**
  - [render.ts:643](src/engine/render.ts) hardcodes
    `conn.from === "user" && conn.to === "need"` to 1.5x a flow particle's
    radius — a domain-specific special case inside the supposedly
    domain-free engine. Add `weight?: number` to `DemoConnection`
    (`src/engine/types.ts`), use it in `render.ts` instead, and set
    `weight: 1.5` on that one connection wherever `userNeedDependency`
    constructs its config.
  - [panel.ts:4,349,363](src/engine/panel.ts) imports and calls
    `characteristicsFor` (a `domain/evolution.ts` function) directly inside
    `showInstrumentPanel`/`updateInstrumentPanel` — the engine reaching into
    domain logic. Change these to accept an already-resolved
    `characteristics: string`, and move the `characteristicsFor` call into
    `phase20.ts` (its only caller).
  - Extract `Question`/`QuestionOption` types out of
    `domain/questionBank.ts` into a new generic `domain/question.ts`;
    re-export from `questionBank.ts` for the existing demo.
  - Full existing test suite (16 files) must stay green; `index.test.ts`
    behavior unchanged. Run via a subagent, never inline (see
    `[[feedback_test_execution]]` memory).

- [ ] **Phase 2 — General domain graph model.** New file
  `src/domain/graph.ts` (+ co-located `graph.test.ts`). Keep
  `Component`/`Dependency`/`EVOLUTION_STAGES` unchanged — already universal.
  ```ts
  export interface WardleyMap { components: Component[]; dependencies: Dependency[] }
  createGraph(spec): WardleyMap
  addComponent(map, component): WardleyMap   // immutable, same convention as valueChain.ts
  addDependency(map, dep): WardleyMap
  mergeGraphs(...maps): WardleyMap
  ```
  No cardinality constraints (unlike `ValueChain`'s enforced "exactly one
  User/Need"), so this covers arbitrary graphs, anti-pattern maps, and
  evolution-only maps (empty `dependencies`) for free. `ValueChain`
  (`src/domain/valueChain.ts`) stays as-is, untouched, as a narrower
  convenience type for the legacy demo only — don't retrofit inheritance.
  Also widen `ComponentKind` (`src/domain/component.ts:1`) from
  `"user" | "need" | "capability"` to `string` — confirmed via grep that
  nothing in `engine/` switches on this closed union today (only
  `valueChain.ts` assigns the three literal values), so this is low-risk.

- [ ] **Phase 3 — General layout family.** New file
  `src/application/graphLayout.ts` (+ tests). `valueChainLayout.ts` is
  untouched (legacy-only). A small family, not one do-everything function,
  and deliberately no auto-layout algorithm — a Wardley map's x-axis has
  fixed evolution semantics, so auto-placement doesn't make sense without
  also guessing evolution stage, which should stay a human judgment call.
  - `manualLayout(map, positions: Map<string, Point>, options): DemoConfig`
    — the common case, author places every node. Covers evolution-only
    drills and freeform/anti-pattern maps.
  - `chainLayout(levels: Component[][], dependencies, options): DemoConfig`
    — generalizes `layoutValueChain`'s row-based math (root row, dependent
    row(s) below) to an arbitrary sequence of rows instead of hardcoded
    User/Need/Capability[].
  - `combineLayouts(parts: {config: DemoConfig, offsetX: number}[]): DemoConfig`
    — merges pre-built `DemoConfig`s side-by-side (shift x, union
    nodes/connections/viewBox). Covers multi-chain maps and comparisons by
    composing the two functions above rather than a bespoke multi-shape
    algorithm.

- [ ] **Phase 3b — Guarantee mascot headroom in every layout.** Found
  2026-07-12: Phase 5's single-Capability anchor sits close to the bottom of
  its authored viewBox (y=468 of a 520-tall box), so its mascot caption
  (`pickMascotPlacement`, `src/engine/mascotPlacement.ts`) has very little
  vertical room to work with. A real host's type scale can push a long
  caption to wrap one more line than expected and clip past the map's bottom
  edge, flipping the mascot from its usual East placement to Northeast —
  confirmed happening on the live `lwm-html` embed (`html { font-size: 18px
  }` there vs. the browser's 16px default, which `preview.html` didn't
  override until this session) but not in local dev, since `preview.html`
  was silently under-simulating the host's real font metrics. Short-term
  mitigation landed this session (`src/engine/styles.ts`: widened
  `.wd-mascot-caption`'s `max-width` 200px→230px, shrunk
  `.wd-next-link--compact`'s padding/font-size; `preview.html`: added
  `html { font-size: 18px }` so this class of bug is visible locally going
  forward) — enough headroom for today's one scenario, not a general
  guarantee. The real fix belongs in the layout family (Phase 3 above):
  whatever function computes a `DemoConfig`'s node positions/viewBox height
  should reserve enough margin — on whichever edge ends up nearest a node —
  that *any* node can host a mascot caption up to 3 lines without the
  caption ever needing to spill past the map bounds. Treat "room for a
  mascot caption beside the lowest (or otherwise most-boxed-in) node" as a
  real layout constraint the layout functions guarantee, not something
  tuned per-scenario after the fact once a host's real fonts expose the gap.

- [ ] **Phase 4 — Exercise runner (the core reusability layer).** Reject a
  rigid "array of steps piped through an interpreter" — it would either
  force awkward data-threading (Phase 10's form answers feed Phase 20's
  labels) or become the declarative interpreter we're deliberately not
  building yet. Instead: extract the pattern already repeated across
  `phase0/10/20/30.ts` into a tested library of step functions an exercise's
  own file calls with plain `await` — same convention as today, less
  duplicated boilerplate.
  - New `src/runner/types.ts`:
    ```ts
    interface ExerciseContext { demo: WardleyDemo; mascot: Mascot; canvas: HTMLElement; mascotHost: HTMLElement }
    mountExercise(canvas, mascotHost, config, options?): ExerciseContext
    ```
  - New `src/runner/steps.ts` (+ tests) — thin, tested wrappers pairing one
    `WardleyDemo` method + one `Mascot` method + the existing "await
    confirm" gating pattern: `dragStep`, `evolutionDragStep`, `formStep`,
    `gateStep`, `questionStep`, `introStep`, `annotateStep`,
    `revealBackdropStep`, `celebrateStep`, `recapStep`.
  - A short drill composes 2-3 of these inline; a longer narrative still
    splits across phase-style files, calling into `runner/steps.ts` instead
    of hand-rolling `WardleyDemo`/`Mascot` calls. Content/copy convention
    going forward (new exercises only, not retrofit onto the existing
    demo): a sibling `content.ts` next to an exercise's `index.ts`, since
    every step already takes a content object distinct from control flow —
    a file-split convention, not a new schema. Each step's content argument
    is already plain/serializable, so a future declarative authoring layer
    could interpret JSON into these same functions later without a rewrite.

- [ ] **Phase 5 — Public API surface.** Extend `src/index.ts` (don't
  replace):
  ```ts
  domain: { createValueChain, createGraph, addComponent, addDependency, mergeGraphs }
  layouts: { layoutValueChain, manualLayout, chainLayout, combineLayouts }
  runner: { mountExercise, dragStep, evolutionDragStep, formStep, gateStep, questionStep, introStep, annotateStep, revealBackdropStep, celebrateStep, recapStep }
  demos: { userNeedDependency, /* + Phase 6 validation exercises */ }
  ```
  `runner` is first-class public API so a lesson page can author a short
  drill entirely inline (see Phase 6's embed example) without a new file in
  this repo at all.

- [ ] **Phase 6 — Validate with 3 deliberately different exercises.** Build
  in `src/demos/<name>/` with co-located integration tests, mirroring
  `index.test.ts`.
  1. `evolutionOnlyDrill` (1-2 steps) — one component, no dependencies,
     `manualLayout` + `evolutionDragStep` + `celebrateStep`. Proves the
     scale-down case and freeform layout.
  2. `chainComparison` (medium) — two independent chains built via the new
     `chainLayout` (not the legacy `layoutValueChain`), placed side-by-side
     via `combineLayouts`, ending in a `gateStep`/`questionStep`
     comparison. Proves multi-chain composition and step reuse outside
     Phase 30's bespoke mechanic.
  3. `antiPatternSpotting` (5-7 steps) — a graph authored with a structural
     anti-pattern (e.g. skipping the Need), walked through `introStep` →
     `revealBackdropStep` → several `gateStep`/`questionStep`/
     `annotateStep` → `recapStep`. Proves the runner scales *up* through a
     non-chain graph using the same step functions.

  These vary shape, length, and mechanic mix on purpose — expect this phase
  to surface gaps in Phases 2-4 and require looping back; that's the point
  of building them now instead of guessing.

  Also add an `examples/` directory with a minimal standalone embed HTML
  per validation exercise, doubling as the reference snippet for how a real
  lesson page will look:
  ```html
  <script src=".../wardley-demo.js"></script>
  <script>
    var ctx = WardleyDemo.runner.mountExercise(canvasEl, mascotHostEl,
      WardleyDemo.layouts.manualLayout(
        WardleyDemo.domain.createGraph({ components: [...], dependencies: [] }),
        new Map([["team", {x: 260, y: 120}]]),
        { viewBox: { width: 400, height: 300 } }));
    await WardleyDemo.runner.evolutionDragStep(ctx, "team", { heading: "Your Team", characteristics: {...} });
    WardleyDemo.runner.celebrateStep(ctx);
  </script>
  ```
  Per-lesson content stays inline in the page, keeping the shared bundle
  exercise-content-free — same principle `index.html`/`preview.html`
  already use today. Flagged, not solved here: once the `demos` registry
  grows, whether the shared bundle needs per-lesson splitting is a
  packaging call to make once bundle size is a *measured* problem, not now.

- [ ] **Phase 7 — Structural dev/test tooling.** `src/dev/autopilot.ts`
  stays untouched, servicing only `userNeedDependency`. For new
  step-vocabulary exercises, replace copy-string/DOM-mutation matching
  (which can't scale to 150 exercises' worth of distinct text) with a
  structural mechanism, since steps are now typed function calls, not
  free-form DOM to guess at.
  - Reuse the existing structural escape hatches `WardleyDemo.skipDrag()` /
    `EvolutionDragHandle.skipDrag()`.
  - New `src/runner/devAutopilot.ts`: an `AutopilotController` that, when
    armed, makes step functions resolve instantly (calling the skip
    methods, or resolving with a default answer) instead of waiting for
    real interaction — since the step functions own their own resolve
    callback directly, no `MutationObserver` needed.
  - Replace the legacy `SkipTarget` string-union with a numeric
    `?skipTo=<stepIndex>` convention for the new exercises: steps
    `0..n-1` resolve instantly, step `n` runs for real. Scales to any
    exercise length with zero per-exercise autopilot code.

- [-] **Migration of `userNeedDependency` onto the new runner — deferred,
  not scheduled.** Don't port it as part of Phases 1-7. It's the one real,
  playtested asset (active feedback-driven changes as recently as
  2026-07-10, see above); its choreography (arrow-cue opening, arrival
  flourish, Part A/B/C relabeling, concept-bank shuffle) is genuinely
  bespoke enough that forcing it onto a same-day, unproven abstraction
  risks regressing working behavior or bloating the step vocabulary to
  serve one caller. Phase 4's step library is built *by extracting* the
  pattern already proven in `phase0/10/20/30.ts` — those files stay the
  reference spec even without literally depending on the new code. Revisit
  after Phase 6, once the runner has real exercises under it and the
  original's playtest churn has settled.

**Explicitly not building as part of Phases 1-7:**
- Declarative JSON/config schema + validator + interpreter — authoring
  model is TS-first per Ben; step functions are already data-shaped enough
  to add this later.
- Auto-layout algorithms — manual/explicit positioning is the correct
  default given evolution's fixed x-axis semantics, not a stopgap.
- Non-mascot exercise UI — everything assumes the existing `Mascot`/`Panel`
  guide.
- Per-lesson/per-exercise bundle splitting — defer until bundle size is a
  measured problem.
- Generalizing Phase 30's concept-bank shuffle/settle mechanic — bespoke to
  one caller today.

**Verification for each phase above:** `npm test` (Vitest + happy-dom) after
every phase, delegated to a subagent per this repo's testing convention,
never inline — full suite green, especially `index.test.ts` unchanged. After
Phase 6, `npm run dev` / `npm run build && npm run preview` and manually run
all 3 validation exercises plus the existing demo through the browser,
confirming no regressions to `userNeedDependency` and that each new exercise
mounts, drags, and completes correctly end-to-end. New modules each get a
co-located `*.test.ts`, matching the existing repo-wide convention.