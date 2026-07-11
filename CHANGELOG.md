# Changelog

Historical record of completed work, pulled out of [TODO.md](TODO.md) to keep
that file focused on what's still open. Newest first.

## 2026-07-10 — v0.1 feedback response

Five decisions made in response to a second playtest round —
`feedback/v0.1/pablogil.txt` (his second walkthrough; compare
`feedback/v0.0/pablogil.txt` for what changed) and `feedback/v0.1/henkoudman.txt`.
Read those files for the full playtester quotes behind each item below.

### 1. Opening frame — defer the mascot past the first celebration

Built as specified below, with one mechanism swap: the plan's original phrasing said the reveal
gate would be "a single link, or `showGate` with one option" — implemented as `Mascot.showGate`
(`MASCOT_BEGIN_GATE`, `phase0.ts`) since that's the existing single-CTA mechanism and needed no new
Panel method. `WardleyDemo` gained three new primitives for this: `addDirectionalArrow` (render.ts's
`createDirectionalArrow`, a static arrow from the Need's `start` to its destination) and
`hideNodeLabels`/`revealNodeLabels` (toggle `wd-node-label--hidden`, a CSS opacity transition). The
mascot now mounts for the first time only after the Need snaps into place, in `phase0.ts`; `MASCOT_NEED_PLACED`
("You made a Value Chain!") moved from `phase5.ts` into `phase0.ts`'s tail, right after the
"Let's begin!" gate and `revealNodeLabels()` call. `phase5.ts` now starts directly with the User
walkthrough. `src/dev/autopilot.ts` auto-clicks the new gate unconditionally (it's a `.wd-panel-
question-option` button, not a `.wd-next-link`) and its `fillAndSubmit` helper now falls back to
clicking a pill chip when a Phase 10 field has no text input (needed for item 2 below too).

### 2. User/Need fields: pill-only, no free text — but keep pills, not a dropdown

Built as specified: `PanelField` (`panel.ts`) gained a `{ type: "choice"; prompt: string; options:
string[] }` variant — `Panel.showField` branches on `field.type` and renders the `"choice"` branch
as a prompt plus a row of `wd-panel-form-example` chips only, no input/placeholder/submit button.
`phase10.ts`'s User field (`options: NEED_CATALOG.map(n => n.userPlaceholder)`) and Need field
(`options: relevantNeeds.map(n => n.label)`) both switched to `type: "choice"`; Capability fields
are unchanged (`type: "text"`, still free typing). Since User is now always an exact `NEED_CATALOG`
value by construction (a pill choice, not free text), the `relevantNeeds` fuzzy-match/fallback logic
in `phase10.ts` can never actually miss anymore — left as defensive dead code rather than removed.

### 3. Evolution intro beat — explain "everything evolves" right before the first drag

Implemented in `phase20.ts`: right after the Phase 10 → 20 gate
(`await mascot.confirmPlacement("Next")`) and before `demo.captureScale`/
`onEvolutionReady`/`showMapBackdrop`, `runPhase20` now shows a
`MASCOT_EVOLUTION_INTRO` placeholder (heading "Everything evolves." /
subheading "As things evolve, how you build, buy, and lead around them
changes too.") gated behind its own `mascot.confirmPlacement("Let's see it
→")` — a distinct label rather than a second generic "Next", so it doesn't
collide with `dev/autopilot.ts`'s plain-"Next" counting. `autopilot.ts`'s
`phase20`/`finale`/`thinking`/`recap` skip targets and `index.test.ts`'s
`reachEvolutionStep` helper were updated to click through the new gate.

Deliberately **not** moved earlier to the capability-selection step (which
is what Pablo originally suggested) — teaching the concept there would be
inert with nothing to anchor it to yet. Keeping it at first point of use was
the deliberate call here.

### 4. Phase 30 — stop and check in the moment a question produces an annotation

Confirmed interpretation: only *insight-producing* answers pause; an answer
with no annotation keeps flowing straight to the next pairing, unchanged.

- `phase30.ts`, inside the `choice === "yes"` branch: after
  `if (answer.annotation) demo.addAnnotation(...)`, the phase now shows a gate —
  `mascot.showGate("Nice insight!\n\nThis sort of thing might factor into your strategy.", "", [{id: "keepGoing", label: "Keep Going"}, {id: "finishUp", label: "Finish Up"}])`.
  "Keep Going" proceeds to `current = remaining[0]` exactly as before; "Finish Up" does what the
  old "Done" choice did — `break` — falling through into the new findings report (see #5) before
  `celebrateAll(2)`.
- This *replaced* the old count-based mechanism entirely: `MIN_SETTLED_BEFORE_DONE`, the `settled`
  `Set`, and the conditional `{id: "done", ...}` option on the regular gate were deleted — the
  regular Yes/No/"Try something else" gate is now always exactly those 3 options, no more
  `settled.size >= 3` bookkeeping anywhere.
- The no-annotation branch (declined/no-insight answers) was left untouched.

### 5. Final findings report, attributed by node *and* concept, before the Finale recap

Ben's call: attribute each finding by concept as well as node (not node
alone) — nearly free since `current.concept.label` is already in scope
wherever `addAnnotation` is called.

- `phase30.ts`: accumulates a local array as the phase runs —
  `const findings: { concept: string; node: string; text: string }[] = []` —
  pushing `{ concept: current.concept.label, node: current.node.label, text: answer.annotation }`
  right alongside the existing `demo.addAnnotation(current.node.id, answer.annotation)`
  call, whenever `answer.annotation` is truthy.
- Once the phase ends — either via "Finish Up" (#4) or the loop naturally exhausting
  `remaining` — the findings render before `celebrateAll(2)`. This needed a new small
  mascot/panel mode, `Mascot.showFindings(items, {heading, subheading})` → `Panel.showFindings`,
  since `showRecap` only takes flat prose lines, not node/concept-attributed entries.
- Framing per Ben: heading "Here's what you found, and you're barely
  scratching the surface!" followed by one line per finding, e.g. "**Alliances**
  → Delivery Driver: {annotation text}".
- If `findings` is empty (visitor declined every concept), the report is skipped
  entirely and it goes straight to `celebrateAll(2)`.
- `finale.ts` was unaffected — its own recap still runs after this, unchanged; the findings
  report is a Phase 30 exit beat, not a Finale change.

## 2026-07-05 — Phase 30 concept-bank rework

Goal: the mascot walks a curated bank of climate/doctrine/leadership concepts
(`domain/conceptBank.ts`'s `CONCEPT_BANK`) against candidate nodes on the map,
each restricted to the node kinds it meaningfully applies to
(`Concept.applicableKinds`, resolved via `candidateNodesForConcept`). For each
(concept, node) pairing, `Panel.showGate`/`Mascot.showGate` leads with a
one-sentence definition of the concept ("In Wardley Mapping,
{concept.definition}.") followed by "Do you think we could learn something
from exploring {concept.label} with {node}?" (subtitle "Choosing is how you learn!" on the very first
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
superseded by the gate's node-cycling and shuffle. (Note: the "Done" option's
count-based gating described here was itself later replaced by the
insight-triggered gate — see 2026-07-10 item 4 above.)

## 2026-07-03 — Feedback-driven fixes

Patterns pulled from summarized playtester notes in `feedback/*.txt` — see those
files for full context per reviewer.

- **Fix: need-topic content leaks across examples.** Selecting one topic
  (e.g. "fresh grocery delivery") surfaced suggestions/placeholders from a
  different topic (tea example: "commuter", "kettle", "kettle"). Hit
  independently by two testers (`pablogil.txt`, `velocirachael.txt`). Fixed
  by giving each `NeedOption` in `needCatalog.ts` its own `userPlaceholder`
  and `capabilityPlaceholders`, and wiring `userNeedDependency.ts`'s form
  steps to use the selected need's placeholders instead of the hardcoded
  tea-example ones.
- **Add a visible "this is draggable" affordance.** Multiple testers
  (`jamesfairbairn.txt`, `joeltosi.txt`) didn't realize a node/capability
  could be dragged until they accidentally clicked it first — no visual
  cue (cursor, glow, handle) currently signaled draggability before the
  first interaction. Addressed by the `wd-node--beckon` pulse (wired to
  the toolbox's active drag slot for Phase 0/10, and to `beckonNode` calls
  before each Phase 20 evolution-drag step) plus the directional
  `wd-node-chevron` cues added alongside `runEvolutionDragStep`.
- **Clarify the opening frame before Phase 0/10 starts.** Five separate
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
  The host page's `.wd-explanation` column (`#vc-answer` + `#vc-next`)
  has since been removed entirely; that payoff copy and both "Next"
  gates now render inside the mascot's own speech bubble
  (`Mascot.confirmPlacement`, `phase10.ts`'s `MASCOT_NEED_PLACED`), so
  `ValueChainScenarioOptions` no longer takes a `nextControl`.
  **Reopened 2026-07-10, then re-fixed:** a fresh v0.1 tester
  (`feedback/v0.1/pablogil.txt`) still described the opening as "a
  puzzle with no goal or context" — this original fix addressed
  copy/placement but not the underlying framing. See "2026-07-10 — v0.1
  feedback response" → item 1 above for the redesign that actually
  resolved it (defer the mascot past the first celebration instead of
  explaining upfront).
- **Accessibility pass on evolution-stage color coding.** `velocirachael.txt`:
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
  band tint alone. Also addressed the separately-flagged small axis-label
  font size: `.wd-backdrop-label` went from 10px/`#999` to 13px/`#333`/
  bold (`src/engine/styles.ts`).
- **Flow animation change by evolutionary stage.**
  Commodity and product flow animations were already fine. Genesis used to
  "sputter" via a jagged, slow animation; changed so the animation path
  follows a random path in the general direction of the connected node
  (think baseball curveball) — conveys that an attempt is made to deliver
  value, but it's mostly missing. Custom-built is a less unpredictable
  version of that; curves but hits most of the time.

## Earlier — initial build (Phase 0 through Finale)

- Phase 0 — Value Chain: generic User → User Need → Capability x3, drag Need into place, celebration.
- Phase 0.5 — Refactor prep: mutable domain labels, decomposed `WardleyDemo` engine ops, swappable-mode `Panel`, `needCatalog.ts`, removed host-page toolbox duplication.
- Phase 7 — Meet Ben: the mascot steps back from the value chain into open canvas whitespace to introduce itself, gated behind a "Next".
- Phase 10 — Personalize the value chain: drag-then-form flow (User dropdown → Need/Capability text fields), live relabeling of domain + rendered nodes, `celebrate(nodeId)` finale.
- Phase 20 — Evolution: map backdrop, per-node evolution-axis drag + confirm (Need then Capability-1/2/3), live characteristics instrument-panel readout, stage-dependent flow-particle animation.
- Finale — big celebration + `Panel.showRecap` with CTA link to LearnWardleyMapping.com.
- Mascot as sole guide — the mascot renders Phase 0's drag affordance and Phase 10's
  form (walking User → Need → Capability-1/2/3 between questions) instead of a sidebar
  Toolbox, which was removed entirely. This leaned toward more guidance, not less — see
  the "Unresolved product tension" item in TODO.md's Feedback-driven TODOs.
- Phase 0 opening reframed — the Need node itself renders on the canvas from the
  start, out of place at its `start` position and pulsing (`wd-node--beckon`) to invite a
  direct drag; the visitor picks it up like any other node instead of dragging a separate
  toolbox-slot icon out of the mascot's bubble. `Panel.showDragHandles`/`PanelDragSlot`/
  `PanelDragHandle` (`panel.ts`) and `Mascot.showDragHandles` (`mascot.ts`) still exist but
  are no longer called by `userNeedDependency.ts` — nothing currently uses them.
