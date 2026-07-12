# Changelog

Historical record of completed work, pulled out of [TODO.md](TODO.md) to keep
that file focused on what's still open. Newest first.

## 2026-07-12 — v0.4.0 credits panel move & evolution-drag jump fix

### End credits become a floating top-right card

`13b16ad`: the end credits used to sit in page flow below the map — easy to miss on a host page a
visitor might not scroll to. Anchored instead as a small floating card in the map's top-right corner
(clear of the mascot/nodes by the time the Finale reveals it), keeping the same scrolling name list
and reveal timing; `#demo-a` becomes `position: relative` via the engine's own `.wardley-demo-root`
class add, so no host-page CSS changes were needed beyond the credits markup itself. Two follow-ups
same evening: `37685f3` added a dismiss button so a visitor can close the card immediately instead of
it sitting in the way indefinitely, and `20e2566` fixed the name-list scroll loop — `translateY(-100%)`
only cleared the list's own height, so the final name rose to the panel's bottom edge and jump-cut
back instead of scrolling fully off-screen; fixed by also subtracting the `.credits-scroll`
container's height, matching how the list starts fully hidden below.

### Evolution-axis drag: fix node jump when confirming without a drag

`ad97a5b`: `slideToGenesis` only wrote `node.x` on natural tween completion, never on cancellation, so
a tap that cancelled the slide mid-flight (or one after it had already finished) left `node.x` stale.
`attachAxisDrag` then snapshotted that stale `node.x` into `currentX` once at setup time, before the
slide had a chance to finish — so confirming without ever actually dragging re-stamped the node back
to its pre-slide position instead of wherever it visually sat. Fixed on both ends: cancelling a slide
now commits `node.x`/`node.y` to wherever the tween had actually reached, and `confirm()` re-reads
`node.x` when no real drag happened instead of trusting the stale setup-time snapshot.

## 2026-07-12 — v0.3.2 preview host-CSS fidelity fix

`4b1b381`: the mascot placed itself East of Phase 5's Capability node in local `preview.html` but
Northeast on the real `lwm-html` embed, for the exact same bundle — `pickMascotPlacement` itself was
fine, `preview.html` just wasn't faithfully mirroring the production host's CSS. Two gaps: `.wd-mascot-caption`
never set its own `box-sizing`, so lwm-html's site-wide `border-box` reset shrank the caption's text
area vs. `preview.html`'s default `content-box`, wrapping the same message into more/taller lines;
and lwm-html's real `html { font-size: 18px }` was never mirrored locally, so the `rem`-sized caption
rendered smaller than production even before that. Combined, the taller caption clipped past the
bottom of Phase 5's viewBox, flipping the placement search's tier-3 overflow scoring from East to
Northeast — reproducible only in production, not locally. Fixed by pinning `.wd-mascot-caption` to
`box-sizing: border-box` (matching `.wd-next-link`/`.wd-mascot-dialog`'s existing pattern), widening
the caption's `max-width` (200px → 230px) and shrinking the compact "Next" button so long captions
need fewer lines, and setting `preview.html`'s root `font-size: 18px` to match lwm-html for real so
this class of drift is visible locally going forward. General fix (guaranteed caption headroom in
every layout, not tuned per scenario) logged as TODO.md's new Phase 3b.

## 2026-07-12 — v0.3 mascot placement & dialog polish

Not driven by a `feedback/` batch — no `feedback/v0.3/` directory exists. This was a run of
iterative product decisions (Ben's own, plus a couple of "found it while building the last thing"
fixes) tightening the mascot placement/dialog system the v0.2 architecture change introduced, plus
a smaller Phase 30 gate-flow cleanup.

### Obstacle-aware mascot placement search

`Mascot.reposition()`'s old logic only kept the avatar clear of the single node it was anchored to
(below it, or above if there was no room) — it could still land on top of a sibling node or run
straight across a connection line, with no signal for which node it was even pointing at. Replaced
with `pickMascotPlacement` (new `src/engine/mascotPlacement.ts`, commit `c8d1b1f`): scores all 8
compass directions (`DIRECTION_PRIORITY`) around the anchor, crossed with both caption sides, against
a `MascotObstacles` snapshot (`WardleyDemo.getObstacles()`: every node circle, connection segment,
and — added same day in `978bd52` — evolution-stage label chip, sourced from the rendered
`.wd-backdrop-label-chip` rects via a new `getStageLabelRects()`). Scoring is tiered, each tier
dominating the next (`HARD_CONSTRAINT_WEIGHT` = 1,000,000 vs. `EDGE_HIT_WEIGHT` = 10,000 vs. raw
overflow-px vs. a `TIE_BREAK_STEP` nudge for `DIRECTION_PRIORITY` order): never overlap a node or a
stage-label chip, never let the avatar land outside the map bounds at all, never let more than
`CAPTION_OFF_MAP_BUDGET` (25%, `71ef193`) of the caption's own width spill past the map's left/right
edges — that whole tier beats "avoid crossing an edge" (soft — crossed only if every direction does),
which beats "prefer less overflow," which beats "prefer natural reading order" (below > above >
beside > diagonal). New `src/engine/geometry.ts` holds the pure, independently-tested geometry
primitives this needs (`rectIntersectsCircle`, `rectIntersectsSegment`, `rectsIntersect`,
`rectOverflow`, `horizontalOverflow`, `inflateRect`) — none of them touch the DOM, so the whole search
is unit-testable without mocking `getBoundingClientRect`. `c8d1b1f` also fixed a latent
floating-point bug this surfaced: a cardinal candidate sits exactly tangent to its own anchor's
inflated collision circle, which rounding could flip into a spurious self-collision (reproduced in
Phase 20, pushing the avatar half off-canvas) — fixed with a 1px `SELF_CLEARANCE_EPSILON`.

Deleted entirely as part of this: the old anchor-only `reposition()` fallback logic that this
replaced (`MascotPlacement`'s `"auto"`/`"northeast"`/`"pinned"` vocabulary was already gone as of
v0.2 — this finishes the job by replacing what v0.2 left as a simple below/above check).

### Keeping the mascot out of the horizontal evolution-drag row

`8a06033`: Phase 20's evolution-axis drag moves a node purely horizontally across the whole map, but
`pickMascotPlacement` often chose a spot directly beside the node (E/W, the only direction clear of
nearby edges) — since the search only ever sees a snapshot, it can't know the node is about to slide
straight through that exact spot. Added `NON_ROW_DIRECTIONS` (`DIRECTION_PRIORITY` minus E/W) and a
new `directions` parameter on `pickMascotPlacement`/`Mascot.moveTo` so `phase20.ts`'s Need/Capability
evolution anchors restrict the search to above/below/diagonal only. `Mascot` tracks the restriction as
`lastDirections` so it survives the window-resize re-anchor path (`trackAnchor`) without falling back
to the full 8-direction default and silently dropping the row restriction mid-drag.

### More dramatic mascot first-entrance flourish

`28f20bb`: `Mascot.arrive()`'s pop-in (played once, right after Phase 0's Need snaps into place) now
overshoots past scale 1 with a slight rotation wobble instead of a flat fade/scale-up (`0.35s` →
`0.48s` keyframe; `ARRIVE_DURATION_MS` bumped `1000` → `1100` to cover the longer tail), and spawns a
firework burst — the same `createFireworkShells` already used for node-snap/evolution-confirm
celebrations — at wherever the avatar actually landed, via a new `lastAvatarCenter` field set every
`reposition()` call and a `ARRIVE_FIREWORK_DELAY_MS` (260ms) timed to the pop-in's ~55% overshoot
peak rather than its first frame. `FIREWORK_CLEANUP_MS` moved to `render.ts` (exported alongside
`createFireworkShells`) to avoid duplicating it between `WardleyDemo.ts` and `mascot.ts`. Still fully
skipped (no transition, no firework, straight to idle) under `prefersReducedMotion()`.

### Phase 5 "recipe" beat: reordering and relabel timing

Three related fixes to how Phase 5 introduces the Capability row, landed as a small cluster of
same-evening commits:

- `b69f818`: the "a Value Chain is like a recipe" line used to play *after* the three Capability
  nodes were already relabeled to Part A/B/C, with the mascot anchored directly at the rightmost
  node. Reordered so the "it takes multiple parts" idea lands before the parts are named, and moved
  the mascot into open canvas whitespace to the right of the whole chain for that beat (the same
  node-independent `moveToViewBoxPoint` technique Phase 7 already uses to step back for its own
  introduction).
- `32a0bd7`: the row-expansion (single Capability node → three) was happening before either recipe
  caption played, so a host config that starts with just one Capability (`index.html`/`preview.html`)
  already showed all three nodes by the time the mascot said the first line. Reordered so the row
  only grows to three — fading the missing two in — right as the *second* caption explains why; the
  mascot's whitespace anchor is now computed from the row's eventual final positions up front so it
  doesn't have to jump again once the row fills in.
- `4e6b05f`: the three Capability nodes stayed under their generic placeholder label through the
  row-growing step and only picked up "Part A"/"Part B"/"Part C" on the *next* beat, so a
  newly-added node briefly showed the wrong label before catching up. Relabel now happens at the
  same moment the row grows to three — already-rendered nodes relabel directly, and still-missing
  ones get their final Part label baked into `addNode` itself so they fade in already named.
- `9adc7c9`: separately, Phase 7's "I'm Ben, by the way" caption used to linger beside the mascot
  during its post-confirm celebration bounce. Added `Mascot.hideCaption()` (clears the caption text
  and adds `.wd-mascot-caption--hidden`, opacity+`pointer-events: none`), called right after the
  "Nice to meet you!" click; reverses automatically the next time `say()` or a panel-hosted method
  renders new caption content.

Test fixups for this cluster (`19cf379`, `063bcbc`, and stray `422e9d8`/`4f1dbb2`/`563fea9`/
`95b61ca`/`ca3d160`/`a5afa77` wording tweaks from a parallel branch merge) are folded in here rather
than listed separately.

### Mascot caption/panel polish

A cluster of smaller UX fixes to the two-surface (caption + dialog panel) mascot architecture v0.2
introduced:

- `9b334db`: `Mascot.say()` always concatenated its heading+subheading arguments into one flat
  string with no rendering distinction, so the two-field split was vestigial — collapsed to a single
  string per caption. `phase5.ts`'s `MASCOT_MULTIPLE_PARTS` becomes two named string constants since
  it was already delivered as two sequential `say()` beats.
- `436d342`: `.wd-mascot-caption-text` was inheriting `text-align: center` from
  `index.html`/`preview.html`'s `.hero` wrapper since the mascot's own styles never set it
  explicitly — pinned to left-align.
- `6dfa7c7` then `dac4aab`: every panel-hosted `show*` method (`showField`, `showGate`,
  `showQuestion`, `showRecap`, `showFindings`, etc.) gained an optional trailing `caption` param,
  threaded through the private `pointToPanel`, so a phase can override the generic "Take a look
  below ↓" pointer line. `dac4aab` then flipped the *default* itself to be content-specific per
  method (drag target, question subject, finding count, etc.) instead of one generic string for
  every case; `phase10.ts`'s three `showField` calls pass explicit overrides ("Pick a user below.
  ↓" / "Pick a user need below. ↓" / "Pick a capability below. ↓") since the `"choice"` field type
  alone doesn't distinguish user/need/capability. `showDragHandles`/`showPlaceholder` were left on
  the generic default since neither has a live call site.
- `6655299`: the dialog panel below the canvas rendered as a visible bordered/shadowed strip even
  with no content (e.g. mid-caption `say()` beats), and its form/choice prompts inherited the same
  centered `text-align` bug the caption had. Added a `wd-panel--empty` class `Panel` toggles around
  `clear()`/`showEmpty()`, and pinned `.wd-panel` to `text-align: left`.

### Phase 25: two-beat entrance

`0c67600`: the single "Use the map to think..." caption between Phase 20 and Phase 30 is now two
beats gated by a "Next" click — `MASCOT_GATHER_TO_THINK` ("Now we gather around the map to think and
discuss our strategy together.") followed by `MASCOT_SPECIAL_QUESTIONS` ("We use dozens of special
questions to find gaps and surface new ideas. Want to try?") — giving Phase 25 its own two-step
entrance rather than a single wall of text.

### Phase 30 gate-flow cleanup

A same-evening run of decisions simplifying the Q&A loop's gate:

- `8ed4073`: dropped the "No" option from the per-pairing gate entirely. It used to drop every
  remaining candidate node for that concept and jump straight to the next concept in bank order —
  redundant with "Try something else" (shuffle), which already covers moving on; the gate is now
  always exactly Yes/"Try something else" (plus "Finish Up" once a finding exists).
- `1f7d8d3`: shrank the gate panel's vertical footprint — dropped the "Choosing is how you
  learn!"/"Keep going!" subtitle entirely (`Panel.showGate`'s `subtitle` param, now omitted from the
  DOM rather than rendered empty when blank), tightened the prompt from `"{definition}\n\nDo you
  think we could learn something from exploring {concept} with {node}?"` to `"{definition} Want to
  explore this with {node}?"`, and laid gate buttons out horizontally instead of stacked whenever
  every option label is three words or fewer (true of every gate today).
- `db7da71`: added a mascot reaction beat after each deep-dive answer. `WardleyDemo.addAnnotation`
  now returns the callout's own viewBox position so the mascot can re-anchor onto it
  (`moveToViewBoxPoint`) before pausing on the "Nice insight!" gate; a blank-annotation answer gets a
  quick "Nothing to note. Got it." aside instead of falling through silently.
- `b847923`, then `ee70809`/`13f6efd`/`b1e793d`: the callout-focus move first played as its own
  `say()` + `confirmPlacement("Next")` beat ahead of the "Nice insight!" gate, requiring an extra
  click; folded into the gate's own `caption` override instead (`showGate`'s new trailing param, see
  above) so the note and the Keep Going/Finish Up choice render as one beat. Wording iterated same
  evening: "Made a note of it here." → "Made a note of it here — take a look below. ↓" → final
  "Made a note of it here. Keep going, below. ↓"; the gate prompt itself also lost its
  `\n\n` double-break ("Nice insight!\n\nThis sort of thing..." → "Nice insight! This sort of
  thing...").
- `30f82ff`: renamed the "Using the Right Methods" concept (`domain/conceptBank.ts`, id
  `right-methods`) to "Use Appropriate Methods" — same definition, reworded to match
  ("...This is called using appropriate methods.").

### Autopilot: fix off-by-one gate count after the recipe-beat merge

`f0bf034`: `src/dev/autopilot.ts`'s `attachAutopilot` hardcodes `plainNextCount` thresholds to tell
apart Phase 0/5/10's identically-labeled "Next" links from each other — a known recurring class of
bug, since the thresholds silently drift whenever a phase's gate count changes (see the 2026-07-10
entry's evolution-intro gate for the same failure mode). Phase 5's recipe explanation dropped from
two captions/gates to one back in `063bcbc` (above), but the thresholds (`<= 6`/`=== 7`/`=== 8`) were
never updated, so `skipTo=celebrate` and friends auto-clicked one gate too far, most visibly skipping
straight past the real Phase 10→20 gate they're supposed to stop at. Rebased down to `<= 5`/`=== 6`/
`=== 7`, plus a new `=== 8` branch for Phase 25's own internal gate (the two-beat split from
`0c67600`), which `thinking`/`recap` previously had no way to click through.

## 2026-07-11 — v0.2 feedback response

### Capability fields: pill-only, matching User/Need

`feedback/v0.2/tristanslominski.txt`: glad he no longer has to type a component name, wants the
precreated pills to be the primary interaction with the type-your-own box removed or de-emphasized.
`phase10.ts`'s three capability sub-questions switched from `type: "text"` (a "Write your own" input
plus example chips) to `type: "choice"` (`remainingCapabilities` as `options`, no input at all) —
the same field shape the 2026-07-10 change already gave User/Need (see that entry's "pill-only, no
free text" below). Safe because every need in `needCatalog.ts` carries 10 `capabilityOptions` and a
chain only ever asks for 3, so there's always enough pills to fill the form without a free-text
escape hatch. `src/dev/autopilot.ts`'s `fillAndSubmit` needed no change — it already branched on
whether a field renders a `.wd-panel-form-input` at all, added generically in the 2026-07-10 change
for the User/Need fields.

### Mascot bubble no longer covers the map

Response to `feedback/v0.2/tristanslominski.txt`'s core complaint: the mascot's dialog covered the
value chain/map while a question was on screen. Rather than another anchor-position tweak (the
`auto`/`northeast`/`pinned` placement vocabulary had already been patched repeatedly for this same
class of bug — `"south"` added then retired, `"pinned"`'s corner-fallback, Phase 10's capability
sub-questions parked at Need instead of each Capability), this was a deliberate architecture change:

- `Mascot` (`src/engine/mascot.ts`) now splits into two surfaces: a small on-canvas **avatar**
  that still tracks whichever node it's discussing (reusing the existing node-position math, much
  simplified now that there's no wide/tall bubble to dodge neighboring rows for), paired with a
  **caption** (`Mascot.say(text)`) for brief single-line asides — and a permanent **dialog panel**
  below the canvas (unchanged `Panel`/`showX` methods: forms, questions, instrument panel,
  findings, recap) for anything structural. The dialog panel can never overlap the map since it's
  a fixed region in the page's own flow, not a bubble anchored over the canvas.
- `say()` is a sequenceable surface — a phase can `await mascot.say(...)` two or three times in a
  row (each gated behind its own `confirmPlacement`) for a short multi-beat exchange, an
  alternative to escalating to the panel for borderline-length content (see `phase5.ts`'s
  "recipe" beat, the one deliberate example of this pattern).
- Whenever a panel-hosted method renders, the avatar's caption auto-switches to a short "Take a
  look below ↓" pointer line (`pointToPanel`), so the visitor's attention follows the mascot down
  to the panel instead of the caption going stale.
- `confirmPlacement` targets whichever surface (caption or panel) most recently rendered content,
  using a new compact button style (`.wd-next-link--compact`) distinct from the full-size "big
  button" treatment kept for genuinely standalone commitments (the form submit, the recap CTA).
- Deleted entirely: `MascotPlacement`/`"auto"`/`"northeast"`/`"pinned"`, `moveToTopRight()`,
  `hideBubbleInstantly()`/`revealBubble()`/`revealBubbleAfterMove()` — all existed only to manage
  the old floating bubble's geometry against neighboring nodes, moot once dialog content no longer
  overlays the canvas at all.
- `index.html`/`preview.html`: `.wd-instance` flips from a row to a column so the new
  `.wd-mascot-dialog-host` stacks below `.wd-canvas` within the existing 740px-max-width layout.
  The dialog panel hugs its own content (no fixed reserved height) and caps growth with
  `max-height`/`overflow-y: auto`, rather than reserving a permanent block that would push an
  already-tall canvas past the viewport on hosts already close to the fold.
- Two real CSS bugs only surfaced in a live browser (not jsdom/happy-dom, which never computes
  real layout): an absolutely-positioned flex container with `flex-wrap` and no explicit width
  shrink-to-fits to its narrowest content line instead of respecting `max-width` (fixed with
  `width: max-content`), and a flex item inside a `flex-direction: column` panel stretches to the
  container's full width by default regardless of its own `width`/`display` (fixed with
  `align-self: flex-start` on the compact button).

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
