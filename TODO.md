# TODO — Tutorial Flow Plan

One continuous demo, not disconnected pieces. The visitor never leaves the canvas; each phase builds on what the last phase left in place.

## Phase 0 — Value Chain (current state)

- [x] Generic User → User Need → Capability x3, drag Need into place, celebration.

## Phase 0.5 — Refactor prep (must land before Phase 1)

- [x] **Mutable domain labels.** `src/domain/valueChain.ts` and `src/domain/component.ts` only build components once, at construction (immutable after `createValueChain`). Add label-update functions. Needed because Phase 1 relabels the *existing* User/Need/Capability nodes with visitor-typed text — it doesn't create new ones.
- [ ] **Decompose the engine's one-shot mount.** `src/engine/WardleyDemo.ts`'s constructor does everything inline in a single pass (build SVG, wire one draggable node, one `onSnapSuccess`, done). Break it into composable internal operations (add a node, relabel a node, run one drag-to-target step) that can be called repeatedly against the same mounted scene. Needed because Phase 1 is itself a 5-step sequence (pick need → type user → type capability ×3 → celebrate) with no drag at all, and Phase 2 repeats a drag-confirm step four times against one persistent map — neither fits "mount once with a fixed config."
- [ ] **`Panel` abstraction for the toolbox.** Currently the toolbox is static markup hand-wired with class-toggling JS, duplicated almost identically in `index.html` and `preview.html`. Introduce a `Panel` with a swappable-mode contract. Implement two modes now: "drag handle" (what exists today) and "form" (dropdown + text inputs, for Phase 1's data entry). Leave room for "instrument panel" (Phase 2's live evolutionary-characteristics readout) and "Q&A" (Phase 3's questions) — don't build those two yet.
- [ ] **User-need catalog module.** New file (e.g. `src/domain/needCatalog.ts`) holding the preset list of user-need options for Phase 1's dropdown, shaped as `{id, label}` (or similar) so Phase 3's question bank can reuse the same shape later.
- [ ] **Replace the static demo with a `Scenario`.** Restructure `src/demos/userNeedDependency.ts` into a `Scenario`: an ordered list of steps, each one rendering the Panel, waiting for visitor input/confirm, mutating the domain, then celebrating and advancing. Move the toolbox-toggling logic currently duplicated in `index.html`'s and `preview.html`'s `<script>` blocks into this shared Scenario code, so both host pages drive one source of truth instead of two copies.

## Phase 1 — Personalize the value chain

- [ ] Toolbox becomes a data-entry panel (no longer a drag source).
- [ ] Visitor selects a user need from a dropdown of preset options.
- [ ] Visitor types their own User who has this need.
- [ ] Visitor types their own three Capabilities this need depends on.
- [ ] Celebration.

## Phase 2 — Evolution

- [ ] A light Wardley map backdrop appears behind the value chain.
- [ ] User node floats above the map; Need and Capabilities sit on the map.
- [ ] Toolbox becomes an instrument panel showing evolutionary characteristics.
- [ ] User Need is selected:
  - [ ] Visitor drags it left/right to set its evolutionary stage.
  - [ ] Toolbox characteristics update live as it moves.
  - [ ] The flow animation between Need and User updates live — genesis sputters (rare, large, unreliable bursts), commodity flows smoothly (frequent, small, reliable repeats).
  - [ ] Visitor confirms placement.
- [ ] Repeat for Capability 1 (characteristics shown may differ — capability-relevant vs. need-relevant).
- [ ] Repeat for Capability 2.
- [ ] Repeat for Capability 3.
- [ ] Celebration.

## Phase 3 — Thinking with the map

- [ ] Toolbox becomes a questions/thinking panel.
- [ ] Q1: pick a capability; question checks for bias in its evolution placement; answer is annotated on the map near that capability.
- [ ] Q2: pick a capability; question determines build/buy/outsource; answer is annotated on the map near that capability.
- [ ] Q3: visitor can hit "random question" repeatedly until they like one, answers it, answer is annotated on the map.

## Finale

- [ ] Big celebration.
- [ ] "Next" control scrolls the visitor to the next section of the page.
