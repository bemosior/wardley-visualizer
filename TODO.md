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

## Done so far

- [x] Phase 0 — Value Chain: generic User → User Need → Capability x3, drag Need into place, celebration.
- [x] Phase 0.5 — Refactor prep: mutable domain labels, decomposed `WardleyDemo` engine ops, swappable-mode `Panel`, `needCatalog.ts`, removed host-page toolbox duplication.
- [x] Phase 7 — Meet Ben: the mascot steps back from the value chain into open canvas whitespace to introduce itself, gated behind a "Next".
- [x] Phase 10 — Personalize the value chain: drag-then-form flow (User dropdown → Need/Capability text fields), live relabeling of domain + rendered nodes, `celebrate(nodeId)` finale.
- [x] Phase 20 — Evolution: map backdrop, per-node evolution-axis drag + confirm (Need then Capability-1/2/3), live characteristics instrument-panel readout, stage-dependent flow-particle animation.
- [x] Finale — big celebration + `Panel.showRecap` with CTA link to LearnWardleyMapping.com.
- [x] Mascot as sole guide — the mascot now renders Phase 0's drag affordance and Phase 10's
      form (walking User → Need → Capability-1/2/3 between questions) instead of a sidebar
      Toolbox, which has been removed entirely. See the unresolved hand-holding tension noted
- [x] Phase 0 opening reframed — the Need node itself now renders on the canvas from the
      start, out of place at its `start` position and pulsing (`wd-node--beckon`) to invite a
      direct drag; the visitor picks it up like any other node instead of dragging a separate
      toolbox-slot icon out of the mascot's bubble. `Panel.showDragHandles`/`PanelDragSlot`/
      `PanelDragHandle` (`panel.ts`) and `Mascot.showDragHandles` (`mascot.ts`) still exist but
      are no longer called by `userNeedDependency.ts` — nothing currently uses them.
      below, since this leans toward more guidance, not less.

## Phase 30 — Thinking with the map (done, concept-bank rework 2026-07-05)

Goal: the mascot walks a curated bank of climate/doctrine/leadership concepts
(`domain/conceptBank.ts`'s `CONCEPT_BANK`) against candidate nodes on the map,
each restricted to the node kinds it meaningfully applies to
(`Concept.applicableKinds`, resolved via `candidateNodesForConcept`). For each
(concept, node) pairing, `Panel.showGate`/`Mascot.showGate` leads with a
one-sentence definition of the concept ("In Wardley Mapping,
{concept.definition}.") followed by "Could we learn something from exploring
this with {node}?" (subtitle "Choosing is how you learn!" on the very first
gate of the phase, "Keep going!" after) with
Yes/No plus a "Try something else" shuffle (jumps to a random other
unresolved pairing) and, once at least 3 concepts have settled, a "Done"
option. Yes opens the concept's fixed deep-dive multiple-choice question
(unchanged `Panel.showQuestion`), and the chosen answer's `annotation` is
anchored to the map via `WardleyDemo.addAnnotation`. See `phase30.ts`'s own
doc comment for the full settle/shuffle/done bookkeeping.

This replaced the original fixed 3-question design (Capability-1 always
bias-check, Capability-2 always build/buy/outsource, Capability-3 a
re-rollable random pool question) — the pool/reroll mechanic is gone,
superseded by the gate's node-cycling and shuffle.

## Next: v0.1 feedback response (planned, not yet built, 2026-07-10)

Five decisions made in response to a second playtest round —
`feedback/v0.1/pablogil.txt` (his second walkthrough; compare
`feedback/v0.0/pablogil.txt` for what changed) and `feedback/v0.1/henkoudman.txt`.
Read those files for the full playtester quotes behind each item below. None of
this is built yet — this section is written to be picked up cold in a fresh
session.

### 1. Opening frame — defer the mascot past the first celebration

Goal: stop explaining the opening ("Solve the puzzle. / Drag the missing piece
into place.", `phase0.ts`'s `MASCOT_INTRO`) and instead remove the puzzle
framing entirely — nothing to explain because there's only one visible thing
to do. A fresh v0.1 tester still reported "no goal, no direction, thrown in a
couple steps" despite the earlier opening-frame fix (see the `[x]` item below,
which this supersedes in mechanism, not just copy).

- `phase0.ts`: currently mounts `Mascot` and calls
  `mascot.showPlaceholder(MASCOT_INTRO.heading, MASCOT_INTRO.subheading)`
  *before* `WardleyDemo.mount()` (`phase0.ts:40-42`). New behavior: don't
  mount or show the mascot yet at all. The Need node still renders
  out-of-place and pulsing (`wd-node--beckon`, unchanged) — add a directional
  arrow as the only affordance, pointing from its `start` position toward its
  destination marker.
- New engine primitive needed: `createEvolutionChevron` (`render.ts:54`) is
  axis-bound (left/right only, tied to `attachAxisDrag`'s min/maxX, only ever
  called from `runEvolutionDragStep`) — **not** directly reusable here, since
  Phase 0's drag (`attachDrag`) moves freely toward an arbitrary target, not
  along a fixed horizontal axis. Add a new one-off arrow primitive (e.g.
  `createDirectionalArrow(fromPixel, toPixel)` in `render.ts`) oriented along
  the vector from the Need's `start` position to its destination — both known
  at mount time via `layoutValueChain`/`demo.getNodePixelPosition` — a static
  orientation is fine, it doesn't need to track live drag position the way
  the evolution chevrons do.
- On drop/snap (today's `onNeedPlaced` callback path, `phase0.ts:59-63`):
  *then* mount the mascot and show a one-button gate — heading "Want to learn
  about Wardley Mapping?", single option "Let's begin!" (a single-CTA gate;
  reuse whichever existing mechanism is cheaper — `confirmPlacement`-style
  single link, or `showGate` with one option). No "No" path — it's a
  rhetorical hype beat, not a real fork.
- Once "Let's begin!" is clicked: node labels transition in (check whether
  `layoutValueChain`-rendered nodes need their labels hidden pre-click, e.g.
  via opacity/visibility, and only revealed at this beat), and the mascot
  says heading "This is a value chain." / subheading "A value chain is a
  recipe for delivering value." — **this exact copy already exists** as
  `phase5.ts`'s `MASCOT_NEED_PLACED` (`phase5.ts:10-13`); move it here and
  delete it from its current spot so it isn't said twice. `runPhase5` should
  then start directly with the User/Need/Capability node-by-node walk
  (`phase5.ts:76` onward).

### 2. User/Need fields: pill-only, no free text — but keep pills, not a dropdown

Correction from an earlier back-and-forth: `PanelField` (`panel.ts:67-73`) has
only one variant today (`type: "text"`) — a text `<input>` plus optional
clickable `examples` chips rendered alongside it. Those chips **are** the
"pills" — there's no `<select>` dropdown anywhere in this codebase. The fix
is adding a new pill-only variant with no `<input>` at all, not swapping to a
browser dropdown:

- Add `{ type: "choice"; prompt: string; options: string[] }` to the
  `PanelField` union in `panel.ts`.
- `Panel.showField` (`panel.ts:186`): branch on `field.type`. The new
  `"choice"` branch renders the prompt plus a row of chip buttons only (reuse
  the `wd-panel-form-example` styling/click-to-resolve behavior at
  `panel.ts:205-220`) — no input, no placeholder text, no "Confirm" submit
  button.
- `phase10.ts`: the User field call (`phase10.ts:21-26`) switches from
  `type: "text"` to `type: "choice"` with
  `options: NEED_CATALOG.map(n => n.userPlaceholder)` (6 unique values today:
  Commuter, Teenager, Home Cook, Traveler, Contractor, Parent). The Need
  field call (`phase10.ts:39-44`) switches to `type: "choice"` with
  `options: relevantNeeds.map(n => n.label)` (already narrowed to the
  matched user). Capability fields (`phase10.ts:74-79`) are **unchanged** —
  stay `type: "text"` with free typing; that's the part nobody complained
  about and Ben confirmed should stay editable.
- Not required to fix now, but worth knowing: since User is always an exact
  `NEED_CATALOG` value by construction, the fuzzy-match/fallback logic at
  `phase10.ts:32-35` and `:51-52` can never actually miss anymore — those
  "falls back to full catalog" branches become dead code. Fine to leave as
  defensive code; simplify later if it's ever touched again.
- Side benefit: this also tightens the still-open "audit assessment copy
  against arbitrary user input" item below — locking User/Need to the
  catalog means Phase 30's deep-dive questions (`domain/conceptBank.ts`) can
  never again land against an unanticipated combination the way "messaging
  with friends → deep commoditization" did in `feedback/v0.0/pablogil.txt`.

### 3. Evolution intro beat — explain "everything evolves" right before the first drag

- `phase20.ts`: insert one new `mascot.showPlaceholder(...)` +
  `await mascot.confirmPlacement("Next")` beat at the very top of
  `runPhase20` (`phase20.ts:54`), right after the Phase 10 → 20 gate
  (`phase20.ts:57`) fires but before `demo.stopCharging`/`showMapBackdrop`/
  the Need's `awaitEvolutionConfirm` call.
- Copy direction from Ben: "more straightforward phrasing" than the current
  instrument-panel text. Placeholder wording to refine before shipping:
  heading "Everything evolves." / subheading "As things evolve, how you
  build, buy, and lead around them changes too."
- Deliberately **not** moved earlier to the capability-selection step (which
  is what Pablo originally suggested) — teaching the concept there would be
  inert with nothing to anchor it to yet. Keeping it at first point of use is
  the deliberate call here.

### 4. Phase 30 — stop and check in the moment a question produces an annotation (done, 2026-07-10)

Confirmed interpretation: only *insight-producing* answers pause; an answer
with no annotation keeps flowing straight to the next pairing, unchanged.

- `phase30.ts`, inside the `choice === "yes"` branch (`phase30.ts:94-101`):
  today, after `if (answer.annotation) demo.addAnnotation(...)`, it silently
  continues to `remaining[0]`. New behavior: if `answer.annotation` is
  truthy, immediately show a gate —
  `mascot.showGate("Nice insight!\n\nThis sort of thing might factor into your strategy.", "", [{id: "keepGoing", label: "Keep Going"}, {id: "finishUp", label: "Finish Up"}])`
  (empty/no subtitle for now, adjust once rendered). "Keep Going" proceeds to
  `current = remaining[0]` exactly as today; "Finish Up" does what today's
  "Done" choice does — `break` (`phase30.ts:92`) — falling through into the
  new findings report (see #5) before `celebrateAll(2)`.
- This *replaces* the old count-based mechanism entirely: delete
  `MIN_SETTLED_BEFORE_DONE` (`phase30.ts:27`), the `settled` `Set`
  (`phase30.ts:69`, `:98`, `:105`), and the conditional
  `{id: "done", ...}` option on the regular gate (`phase30.ts:83`) — the
  regular Yes/No/"Try something else" gate is now always exactly those 3
  options, no more `settled.size >= 3` bookkeeping anywhere.
- The no-annotation branch (declined/no-insight answers) is untouched — the
  `remaining`/`current` advancing logic at `phase30.ts:103-110` stays as-is.

### 5. Final findings report, attributed by node *and* concept, before the Finale recap (done, 2026-07-10)

Ben's call: attribute each finding by concept as well as node (not node
alone) — nearly free since `current.concept.label` is already in scope
wherever `addAnnotation` is called.

- `phase30.ts`: accumulate a local array as the phase runs —
  `const findings: { concept: string; node: string; text: string }[] = []` —
  push `{ concept: current.concept.label, node: current.node.label, text: answer.annotation }`
  right alongside the existing `demo.addAnnotation(current.node.id, answer.annotation)`
  call (`phase30.ts:96`), whenever `answer.annotation` is truthy.
- Once the phase ends — either via "Finish Up" (new, see #4) or the loop
  naturally exhausting `remaining` (today's existing exit path) — render the
  findings before `celebrateAll(2)` (`phase30.ts:114`, after today's
  `mascot.showEmpty()`). This needs a new small mascot/panel mode (e.g.
  `Mascot.showFindings(items, {heading, subheading})` → `Panel.showFindings`)
  since `showRecap` (`mascot.ts:515`, `panel.ts`) only takes flat prose
  lines, not node/concept-attributed entries.
- Framing per Ben: heading "Here's what you found, and you're barely
  scratching the surface!" followed by one line per finding, e.g. "**Alliances**
  → Delivery Driver: {annotation text}".
- If `findings` is empty (visitor declined every concept), skip the report
  entirely and go straight to `celebrateAll(2)` as today.
- `finale.ts` is unaffected — its own recap (`finale.ts:14-17`) still runs
  after this, unchanged; the findings report is a Phase 30 exit beat, not a
  Finale change.

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
      wired to the toolbox's active drag slot for Phase 0/10, and to
      `beckonNode` calls before each Phase 20 evolution-drag step) plus the
      directional `wd-node-chevron` cues added alongside `runEvolutionDragStep`
      (`chevrons`, `unsubtle beckon`, `WIP to help focus during evolution
      dragging` commits).
- [x] **Clarify the opening frame before Phase 0/10 starts.** Five separate
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
      The definition reveal (`#vc-answer`, shown via `onNeedPlaced`) was
      unchanged at the time — still the payoff once the visitor completes the
      drag. **Update:** the host page's `.wd-explanation` column (`#vc-answer`
      + `#vc-next`) has since been removed entirely; that payoff copy and both
      "Next" gates now render inside the mascot's own speech bubble
      (`Mascot.confirmPlacement`, `phase10.ts`'s `MASCOT_NEED_PLACED`), so
      `ValueChainScenarioOptions` no longer takes a `nextControl`.
      **Reopened 2026-07-10:** a fresh v0.1 tester (`feedback/v0.1/pablogil.txt`)
      still described the opening as "a puzzle with no goal or context" — this
      fix addressed copy/placement but not the underlying framing. See "Next:
      v0.1 feedback response" → item 1 above for the planned redesign (defer
      the mascot past the first celebration instead of explaining upfront).
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
- [x] **Accessibility pass on evolution-stage color coding.** `velocirachael.txt`:
      color bars used for evolution stages were not visible to her (high
      eye pressure/migraine, possibly compounded by monitor settings) —
      color-only encoding is a known contrast failure mode regardless of
      her specific condition; add higher-contrast or bordered/labeled
      alternatives. Fixed in `createMapBackdrop` (`src/engine/render.ts`):
      each band now also carries a distinct non-color texture (diagonal
      hatch/dots/crosshatch/horizontal lines via SVG `<pattern>` defs) so
      stages stay distinguishable with zero color perception, and each
      stage's axis label is wrapped in a bordered chip (`wd-backdrop-label-chip`,
      full-opacity stage-colored `stroke`) instead of relying on the faint
      band tint alone. Also addresses the separately-flagged small axis-label
      font size: `.wd-backdrop-label` went from 10px/`#999` to 13px/`#333`/
      bold (`src/engine/styles.ts`).
- [ ] **Mobile drag/select gesture polish.** `rianporter.txt`: needed to
      zoom, and distinguishing "select" from "drag" took some learning on
      mobile — worth a dedicated mobile pass once desktop flow is settled.
- [-] **Unresolved product tension — guided prompts vs. discovery.**
      `rianporter.txt` explicitly argues against more hand-holding
      ("people are smart"), while `tomgeraghty.txt`, `joshkruszynski.txt`,
      and `joeltosi.txt` all ask for more explicit prompts. Not a bug — a
      design call to make deliberately, not average away. Note: extending the
      mascot to Phase 0/10 (see "Done so far") leans toward the more-guidance
      side of this tension, not something playtesters asked for by name — not
      resolved here, just flagged since it's now more load-bearing than before.
- [x] **Flow animation change by evolutionary stage.**
      Commodity and product flow animations are perfect. Genesis currently
      "sputters" by having a more jagged, slow animation. Instead of that,
      let's have the animation path follow a random path in the general
      direction of the connected node (think baseball curveball). Conveys
      that an attempt is made to deliver value, but it's mostly missing.
      Custom-built is then a less unpredictable version of that; curves
      but hits most of the time.