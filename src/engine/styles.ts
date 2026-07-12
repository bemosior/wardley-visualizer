const STYLE_ID = "wardley-demo-styles";

/**
 * the base floor for `.wd-panel-content`'s CSS min-height (used by the mascot's own dialog panel
 * only where that panel needs to reserve real vertical space up front, e.g. `showDragHandles`'s
 * intro) and a `targetHeightPx` a host page can still pass to `WardleyDemo.growToFillContainer`/
 * `showMapBackdrop` if it independently wants a taller map canvas -- no longer tied to reserving
 * room for a floating mascot bubble, since the dialog panel lives below the canvas now and sizes
 * to its own content instead.
 */
export const PANEL_CONTENT_MIN_HEIGHT = 360;

const CSS = `
.wardley-demo-root,
.wd-panel,
.wd-mascot {
  --wd-color-ink: #1a1a1a;
  --wd-color-link: #005f99;
  --wd-color-link-hover: #003d6b;
  --wd-color-border: #e5e5e5;
  --wd-color-bg-soft: #f5f5f5;
  --wd-color-stage-genesis: #8e44ad;
  --wd-color-stage-custom: #2980b9;
  --wd-color-stage-product: #27ae60;
  --wd-color-stage-commodity: #7f8c8d;
  --wd-color-flow: #7ec8ff;
  --wd-font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wardley-demo-root {
  display: block;
  width: 100%;
  position: relative;
  z-index: 1;
}

/* pins the panel's own text alignment regardless of whatever text-align a host page sets on an
   ancestor (e.g. index.html's centered .hero) -- same reasoning as .wd-mascot-caption's own pin
   below. Individual elements that want to be centered (the recap CTA, a next-link) already set
   their own explicit text-align: center and win over this via direct styling, not inheritance. */
.wd-panel {
  text-align: left;
}

.wardley-demo-root svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

/** the whole evolution-axis backdrop fades in as a unit when it first appears (Phase 20's transition into a map) rather than popping in instantly */
.wd-backdrop {
  animation: wd-fade-in 0.8s ease-out;
}

.wd-backdrop-band {
  opacity: 0.12;
}

.wd-backdrop-band--genesis {
  fill: var(--wd-color-stage-genesis);
}

.wd-backdrop-band--custom {
  fill: var(--wd-color-stage-custom);
}

.wd-backdrop-band--product {
  fill: var(--wd-color-stage-product);
}

.wd-backdrop-band--commodity {
  fill: var(--wd-color-stage-commodity);
}

.wd-backdrop-band-texture {
  pointer-events: none;
}

.wd-backdrop-pattern-mark {
  fill: var(--wd-color-ink, #1a1a1a);
  fill-opacity: 0.2;
  stroke: var(--wd-color-ink, #1a1a1a);
  stroke-opacity: 0.2;
  stroke-width: 1;
}

.wd-backdrop-divider {
  stroke: var(--wd-color-border);
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.wd-backdrop-label-chip {
  fill: #fff;
  stroke-width: 2;
  pointer-events: none;
}

.wd-backdrop-label-chip--genesis {
  stroke: var(--wd-color-stage-genesis);
}

.wd-backdrop-label-chip--custom {
  stroke: var(--wd-color-stage-custom);
}

.wd-backdrop-label-chip--product {
  stroke: var(--wd-color-stage-product);
}

.wd-backdrop-label-chip--commodity {
  stroke: var(--wd-color-stage-commodity);
}

.wd-backdrop-label {
  font-family: var(--wd-font-ui);
  font-size: 13px;
  font-weight: 600;
  fill: #333;
  text-anchor: middle;
  pointer-events: none;
  user-select: none;
}

.wd-map-caption {
  font-family: var(--wd-font-ui);
  font-size: 22px;
  font-weight: 700;
  fill: var(--wd-color-ink, #1a1a1a);
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  user-select: none;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.wd-map-caption--visible {
  opacity: 1;
}

.wd-map-caption-em {
  font-style: italic;
}

.wd-node-shape {
  fill: #fff;
  stroke: var(--wd-color-ink, #1a1a1a);
  stroke-width: 1.5;
}

.wd-node-label {
  font-family: var(--wd-font-ui);
  font-size: 14px;
  fill: var(--wd-color-ink, #1a1a1a);
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  user-select: none;
  transition: opacity 0.5s ease;
}

/** hides a node's label (Phase 0's opening beat, before the Need is dragged into place) — opacity, not visibility, so the fade transition above applies */
.wd-node-label--hidden {
  opacity: 0;
}

.wd-direction-arrow-shaft {
  stroke: var(--wd-color-link, #005f99);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 6 6;
  animation: wd-direction-arrow-dash 1s linear infinite;
}

.wd-direction-arrow-head {
  fill: var(--wd-color-link, #005f99);
}

@keyframes wd-direction-arrow-dash {
  to {
    stroke-dashoffset: -24;
  }
}

.wd-node--draggable {
  cursor: grab;
  touch-action: none;
}

.wd-node--draggable:active {
  cursor: grabbing;
}

.wd-node--beckon .wd-node-shape {
  transform-box: fill-box;
  transform-origin: center;
  animation: wd-pulse 1.4s ease-in-out infinite;
}

.wd-node-chevron {
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.wd-node-chevron--hidden {
  opacity: 0;
}

.wd-node-chevron-mark {
  fill: none;
  stroke: var(--wd-color-link, #005f99);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.wd-node-chevron--right .wd-node-chevron-mark {
  animation: wd-chevron-nudge-right 1.4s ease-in-out infinite;
}

.wd-node-chevron--left .wd-node-chevron-mark {
  animation: wd-chevron-nudge-left 1.4s ease-in-out infinite;
}

@keyframes wd-chevron-nudge-right {
  0%, 100% { transform: translateX(0); opacity: 0.5; }
  50% { transform: translateX(5px); opacity: 1; }
}

@keyframes wd-chevron-nudge-left {
  0%, 100% { transform: translateX(0); opacity: 0.5; }
  50% { transform: translateX(-5px); opacity: 1; }
}

@keyframes wd-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/**
 * transient entrance for a node added mid-scenario (e.g. Phase 5 filling in the two missing
 * Capability nodes beside the one Phase 0 already rendered) — an animation, not a transition,
 * so it plays reliably even though the class is added in the same tick the node is appended (a
 * transition there would need the deferred-reflow trick showMapCaption uses; see WardleyDemo.ts
 * addNode's animateIn option).
 */
.wd-node--entering {
  animation: wd-fade-in 0.4s ease-out;
}

.wd-node--entering .wd-node-shape {
  transform-box: fill-box;
  transform-origin: center;
  animation: wd-node-enter-pop 0.4s ease-out;
}

@keyframes wd-node-enter-pop {
  from { transform: scale(0.5); }
  to { transform: scale(1); }
}

/** same idea as .wd-node--entering, for a connection line added after activateLines() has already fired (see addConnection) */
.wd-line--entering {
  animation: wd-fade-in 0.4s ease-out;
}

/**
 * a node whose evolution-drag turn hasn't arrived yet (see Phase 20's capability loop) — muted so
 * it doesn't read as interactive next to whichever node is currently beckoning. Muted via stroke/
 * fill color rather than opacity: the shape's white fill must stay fully opaque, or the connection
 * line and backdrop band behind it bleed through and the node reads as a hollow ghost outline
 * instead of a solid (just inactive) node.
 */
.wd-node--pending .wd-node-shape {
  stroke: var(--wd-color-border);
}

.wd-node--pending .wd-node-label {
  fill: #999;
}

@keyframes wd-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 0 rgba(0, 95, 153, 0));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 16px rgba(0, 95, 153, 0.9));
    transform: scale(1.06);
  }
}

.wd-node--charged .wd-node-shape {
  transform-box: fill-box;
  transform-origin: center;
  animation: wd-node-charged 2.4s ease-in-out infinite;
}

@keyframes wd-node-charged {
  0%, 100% {
    filter: drop-shadow(0 0 0 rgba(126, 200, 255, 0));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 10px rgba(126, 200, 255, 0.7));
    transform: scale(1.02);
  }
}

.wd-target-marker {
  opacity: 0.6;
  transition: opacity 0.25s ease;
}

.wd-target-marker--hidden {
  opacity: 0;
}

.wd-target-marker-shape {
  fill: none;
  stroke: #999;
  stroke-width: 1.5;
  stroke-dasharray: 5 5;
  animation: wd-target-marker-dash 1.2s linear infinite;
}

@keyframes wd-target-marker-dash {
  to { stroke-dashoffset: -10; }
}

.wd-line {
  stroke: #999;
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  opacity: 0.5;
}

.wd-line--active {
  stroke: var(--wd-color-link, #005f99);
  stroke-width: 2.5;
  stroke-dasharray: none;
  opacity: 1;
  transition: stroke 0.3s ease, opacity 0.3s ease, stroke-width 0.3s ease;
}

.wd-line--active:nth-of-type(2) { transition-delay: 0.08s; }
.wd-line--active:nth-of-type(3) { transition-delay: 0.16s; }

.wd-flow-particle {
  fill: var(--wd-color-flow, #7ec8ff);
  filter: drop-shadow(0 0 3px rgba(126, 200, 255, 0.9));
  pointer-events: none;
  offset-rotate: 0deg;
  animation-name: wd-particle-travel;
  /* overridden per-particle via inline style, driven by evolution stage — see flowParamsForStage in render.ts */
  animation-duration: 2.0s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes wd-particle-travel {
  0% { offset-distance: 100%; opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  /* a "missed" particle (render.ts's rollMissStopPercent) sets --wd-stop-distance inline so it fades
     out short of the destination instead of completing the ride */
  100% { offset-distance: var(--wd-stop-distance, 0%); opacity: 0; }
}

.wd-firework-shell {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: transparent;
  pointer-events: none;
  transform: translate(-50%, -50%);
  box-shadow: var(--wd-fw-start);
  animation: wd-firework-burst 1.1s ease-out forwards;
  z-index: 2;
}

@keyframes wd-firework-burst {
  0% { box-shadow: var(--wd-fw-start); opacity: 0; }
  10% { opacity: 1; }
  75% { box-shadow: var(--wd-fw-end); opacity: 1; }
  100% { box-shadow: var(--wd-fw-end); opacity: 0; }
}

.wd-annotation-leader {
  stroke: #999;
  stroke-width: 1.5;
}

.wd-annotation-bg {
  fill: #fff;
  stroke: var(--wd-color-ink, #1a1a1a);
  stroke-width: 1;
}

.wd-annotation-text {
  font-family: var(--wd-font-ui);
  font-size: 10px;
  fill: var(--wd-color-ink, #1a1a1a);
  text-anchor: middle;
  dominant-baseline: middle;
  pointer-events: none;
  user-select: none;
}

.wd-panel-content {
  min-height: ${PANEL_CONTENT_MIN_HEIGHT}px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* the mascot's dialog panel should hug its content rather than reserve a fixed height across mode
   switches, unlike the base .wd-panel-content rule above -- a permanent min-height block below an
   already-tall canvas risks pushing the whole embed past the viewport on hosts that are already
   close to the fold. See .wd-mascot-dialog's own max-height/overflow rule below for the matching
   cap on the other direction (a very long piece of content shouldn't grow the page unbounded
   either). */
.wd-mascot-dialog .wd-panel-content {
  min-height: 0;
}

.wd-panel-content--top {
  justify-content: flex-start;
}

.wd-panel-placeholder {
  opacity: 0;
  transition: opacity 0.6s ease;
}

.wd-panel-placeholder--visible {
  opacity: 1;
}

.wd-panel-placeholder-heading {
  font-family: var(--wd-font-ui);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--wd-color-ink);
  text-align: left;
}

.wd-panel-placeholder-subheading {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  color: #999;
  text-align: left;
  margin-top: 0.25rem;
  white-space: pre-line;
}

.wd-name {
  font-weight: 700;
  color: var(--wd-color-link, #005f99);
}

.wd-panel-instrument-characteristics {
  font-family: var(--wd-font-ui);
  font-size: 0.8rem;
  color: var(--wd-color-ink);
  text-align: left;
  line-height: 1.35;
  margin-top: 0.75rem;
  padding: 0 0.5rem;
}

.wd-panel-recap-list {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  color: var(--wd-color-ink);
  line-height: 1.5;
  text-align: left;
  list-style: none;
  margin: 0.75rem 0 0;
  padding-left: 0;
}

.wd-panel-recap-list li + li {
  margin-top: 0.5rem;
}

.wd-panel-recap-list li {
  display: flex;
  gap: 0.5rem;
}

.wd-panel-recap-list li::before {
  content: "🎉";
  flex: none;
}

.wd-panel-findings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wd-panel-findings-label {
  font-family: var(--wd-font-ui);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #999;
}

.wd-panel-collapse-toggle {
  flex: none;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--wd-color-border);
  border-radius: 6px;
  background: #fff;
  color: var(--wd-color-ink);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.wd-panel-collapse-toggle:hover {
  background: #f2f2f2;
}

.wd-panel-findings-body {
  margin-top: 0.5rem;
}

.wd-panel-findings-body--collapsed {
  display: none;
}

.wd-panel-findings-list {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  color: var(--wd-color-ink);
  line-height: 1.5;
  text-align: left;
  list-style: none;
  margin: 0.75rem 0;
  padding-left: 0;
}

.wd-panel-findings-list li + li {
  margin-top: 0.5rem;
}

.wd-panel-recap-cta {
  text-align: center;
  margin-top: 1rem;
}

.wd-next-link {
  display: block;
  width: 100%;
  box-sizing: border-box;
  font-family: var(--wd-font-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
  font-size: 0.9rem;
  line-height: 1.3rem;
  padding: 0.6rem 1rem;
  border: 1px solid var(--wd-color-link, #005f99);
  border-radius: 8px;
  background: var(--wd-color-link, #005f99);
  color: #fff;
  text-decoration: none;
  text-align: center;
  cursor: pointer;
}

.wd-next-link:hover {
  background: var(--wd-color-link-hover, #003d6b);
  border-color: var(--wd-color-link-hover, #003d6b);
}

/* an in-context "go ahead" click (Mascot.confirmPlacement) rather than a standalone commitment
   like a form submit or the recap CTA -- smaller footprint so it sits comfortably beside the
   mascot's small caption, or inline within an in-progress panel readout. Declared after the base
   rule above so it overrides display/width/padding/font-size while still inheriting border/
   background/color/border-radius/cursor from it. align-self: flex-start is needed too -- this
   button renders as a flex item inside .wd-panel-content's column flex layout, which stretches
   items to the full cross-axis width by default (align-items: stretch) regardless of the item's
   own display/width. */
.wd-next-link--compact {
  display: inline-block;
  align-self: flex-start;
  width: auto;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  line-height: 1.2rem;
}

.wd-panel-placeholder .wd-next-link {
  text-align: center;
  margin-top: 0.75rem;
}

.wd-panel-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 0.5rem;
  margin-bottom: 0.5rem;
  border: 1px dashed var(--wd-color-border);
  border-radius: 8px;
  background: #fff;
  cursor: not-allowed;
  user-select: none;
}

.wd-panel-slot:last-child {
  margin-bottom: 0;
}

.wd-panel-slot svg {
  width: 64px;
  height: 64px;
  filter: grayscale(1);
  opacity: 0.4;
}

.wd-panel-slot circle {
  fill: #fff;
  stroke: var(--wd-color-ink);
  stroke-width: 1.5;
}

.wd-panel-slot text {
  font-family: var(--wd-font-ui);
  font-size: 7.6px; /* matches .wd-node-label's font-size/radius ratio (14px / 48 NODE_RADIUS) scaled to ICON_RADIUS (26) */
  fill: var(--wd-color-ink);
  text-anchor: middle;
  dominant-baseline: middle;
}

.wd-panel-slot-label {
  font-family: var(--wd-font-ui);
  font-size: 0.7rem;
  color: #999;
}

.wd-panel-slot--active {
  border: 1px solid var(--wd-color-link);
  background: #f0f7ff;
  cursor: grab;
  touch-action: none;
}

.wd-panel-slot--active:active {
  cursor: grabbing;
}

.wd-panel-slot--active svg {
  filter: none;
  opacity: 1;
}

.wd-panel-slot--active circle {
  animation: wd-panel-pulse 1.8s ease-in-out infinite;
}

.wd-panel-slot--active .wd-panel-slot-label {
  color: var(--wd-color-link);
  font-weight: 600;
}

@keyframes wd-panel-pulse {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(0, 95, 153, 0)); }
  50% { filter: drop-shadow(0 0 6px rgba(0, 95, 153, 0.55)); }
}

.wd-panel-question-prompt {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  color: var(--wd-color-ink);
  text-align: left;
  margin-top: 0.5rem;
  white-space: pre-line;
}

.wd-panel-question-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

/* short (<=3 word) option sets -- e.g. a gate's Yes/No/Try something else -- lay out in a row
   instead of a stacked column, since a column of one-word buttons wastes vertical space. */
.wd-panel-question-options--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.wd-panel-question-options--horizontal .wd-panel-question-option {
  text-align: center;
}

.wd-panel-question-option {
  font-family: var(--wd-font-ui);
  font-size: 0.8rem;
  line-height: 1.3;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--wd-color-border);
  border-radius: 6px;
  background: #fff;
  color: var(--wd-color-ink);
  cursor: pointer;
}

.wd-panel-question-option:hover {
  border-color: var(--wd-color-link);
  background: #f0f7ff;
}

.wd-panel-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wd-panel-form-prompt {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  color: var(--wd-color-ink);
}

.wd-panel-form-input {
  font-family: var(--wd-font-ui);
  font-size: 0.9rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--wd-color-border);
  border-radius: 6px;
}

.wd-panel-form-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.wd-panel-form-example {
  font-family: var(--wd-font-ui);
  font-size: 0.75rem;
  line-height: 1.3;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--wd-color-border);
  border-radius: 999px;
  background: #fff;
  color: var(--wd-color-ink);
  cursor: pointer;
}

.wd-panel-form-example:hover {
  border-color: var(--wd-color-link);
  background: #f0f7ff;
  color: var(--wd-color-link);
}

.wd-panel-form-submit {
  font-family: var(--wd-font-ui);
  font-size: 0.85rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--wd-color-link);
  border-radius: 6px;
  background: var(--wd-color-link);
  color: #fff;
  cursor: pointer;
}

/*
 * host-supplied overlay the mascot's avatar mounts into -- must be a child of the same element
 * passed to WardleyDemo.mount as its container (not a sibling positioned elsewhere in the page),
 * sized to cover it exactly, so WardleyDemo.getNodePixelPosition's coordinates (measured relative
 * to that same container's top-left, the same space fireworkAt already renders into) line up
 * pixel-for-pixel with .wd-mascot's left/top. pointer-events: none lets clicks fall through to
 * the map/nodes underneath everywhere. .wd-mascot itself stays pointer-events: none too -- only
 * .wd-mascot-caption re-enables pointer events, since it's the one piece that's actually
 * interactive (a confirm button, when one is showing).
 */
.wd-mascot-avatar-host {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.wd-mascot {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 3;
  pointer-events: none;
  transition: left 0.4s ease, top 0.4s ease;
}

/* higher specificity than ".wardley-demo-root svg" above, which would otherwise stretch this
   avatar to the canvas's full width since it's nested inside .wardley-demo-root */
.wardley-demo-root .wd-mascot-avatar {
  width: 40px;
  height: 60px;
  flex-shrink: 0;
  pointer-events: none;
  image-rendering: pixelated;
  transform-origin: center;
}

.wd-mascot-avatar.wd-mascot--talking {
  animation: wd-mascot-talk 0.6s ease-in-out;
}

.wd-mascot-avatar.wd-mascot--celebrating {
  animation:
    wd-node-charged 2.4s ease-in-out infinite,
    wd-mascot-celebrate 0.8s ease-in-out;
}

@keyframes wd-mascot-talk {
  0%,
  100% {
    transform: scale(1) translateY(0);
  }
  30% {
    transform: scale(1.05) translateY(-2px);
  }
  60% {
    transform: scale(0.97) translateY(1px);
  }
}

@keyframes wd-mascot-celebrate {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
  }
  25% {
    transform: scale(1.12) rotate(-6deg);
  }
  75% {
    transform: scale(1.12) rotate(6deg);
  }
}

/* fires only while the mascot's first-appearance arrival flourish is playing (Mascot.arrive) --
   a higher-specificity 3-class selector so it wins over the plain celebrating rule above instead
   of fighting it for the animation shorthand, letting the pop-in and the reused celebrate
   bounce/glow run together. */
.wd-mascot--arriving .wd-mascot-avatar.wd-mascot--celebrating {
  animation:
    wd-mascot-arrive 0.48s ease-out,
    wd-node-charged 2.4s ease-in-out infinite,
    wd-mascot-celebrate 0.8s ease-in-out 0.28s;
}

@keyframes wd-mascot-arrive {
  0% {
    opacity: 0;
    transform: scale(0.3) rotate(-8deg);
  }
  55% {
    opacity: 1;
    transform: scale(1.18) rotate(4deg);
  }
  75% {
    transform: scale(0.94) rotate(-2deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}

.wd-mascot--arriving .wd-mascot-caption {
  opacity: 0;
}

/*
 * the small caption beside the avatar -- a single-line, fixed-max-width tag for brief narrative
 * beats and simple confirmations (Mascot.say/confirmPlacement), positioned relative to the avatar
 * rather than in normal flow so it never affects the avatar's own layout. Deliberately much
 * smaller and simpler than the old floating bubble it replaces: capped small enough that its only
 * geometry concern is a left/right flip (clampCaptionHorizontally), not the multi-row vertical
 * clearance math a wide, tall, arbitrary-content bubble used to need.
 */
.wd-mascot-caption {
  position: absolute;
  top: 50%;
  left: calc(100% + 8px); /* matches mascot.ts's CAPTION_GAP */
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
  /* the caption text itself is a block element that would otherwise inherit whatever
     text-align the host page sets on an ancestor (e.g. index.html's centered .hero) -- pin it
     explicitly so multi-line captions always read left-aligned regardless of host page CSS. */
  text-align: left;
  /* an absolutely-positioned flex container with no explicit width computes its shrink-to-fit
     size from the *narrowest* line its content can wrap to (effectively its widest single word)
     when combined with flex-wrap: wrap, not from max-width -- same shrink-to-fit gotcha the old
     .wd-mascot flex row used to hit (see git history). width: max-content forces it to prefer its
     natural (unwrapped) content width instead, still capped by max-width below. */
  width: max-content;
  max-width: 200px;
  background: #fff;
  border: 1px solid var(--wd-color-border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 0.35rem 0.6rem;
  pointer-events: auto;
  font-family: var(--wd-font-ui);
  font-size: 0.78rem;
  line-height: 1.25;
  color: var(--wd-color-ink);
  opacity: 1;
  transition: opacity 0.4s ease;
}

/* mascot.ts's clampCaptionHorizontally adds this when the caption doesn't have room on the
   avatar's right side but does on its left */
.wd-mascot-caption--flip {
  left: auto;
  right: calc(100% + 8px); /* matches mascot.ts's CAPTION_GAP */
}

/* Mascot.hideCaption's marker -- hides the caption box itself, not just its (already-cleared)
   text, so no empty bubble lingers beside the avatar (e.g. Phase 7's celebration bounce) */
.wd-mascot-caption--hidden {
  opacity: 0;
  pointer-events: none;
}

.wd-mascot-caption-action:empty {
  display: none;
}

/*
 * the mascot's permanent dialog panel -- lives in its own host below the canvas (see
 * .wd-mascot-dialog-host, wired via WardleyDemo.mount's sibling markup in index.html/preview.html),
 * not overlaid on top of it, so it can never cover the map/value-chain. Hugs its own content
 * (.wd-mascot-dialog .wd-panel-content above overrides the base min-height) rather than reserving
 * a fixed height across every mode switch -- a permanent tall block below an already-tall canvas
 * risks pushing the whole embed past the viewport on hosts that are already close to the fold.
 * max-height + overflow-y caps the other direction: one long piece of content (a long findings
 * list, a wide capability chip grid) scrolls inside the panel instead of growing the page's total
 * height without bound.
 */
.wd-mascot-dialog-host {
  width: 100%;
  box-sizing: border-box;
}

.wd-mascot-dialog {
  background: #fff;
  border: 1px solid var(--wd-color-border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0.75rem 1rem;
  width: 100%;
  box-sizing: border-box;
  max-height: 45vh;
  overflow-y: auto;
  opacity: 1;
  transition: opacity 0.4s ease;
}

.wd-mascot-dialog--arriving {
  opacity: 0;
}

/* Panel.showEmpty (and the panel's own never-rendered starting state, see the wd-panel--empty
   class added in Panel's constructor) collapses the dialog box entirely -- an empty bordered/
   shadowed strip below the canvas whenever the mascot has nothing to say there (e.g. mid-caption
   beats via say()) reads as a stray UI glitch, not an intentional empty state. */
.wd-mascot-dialog.wd-panel--empty {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .wd-panel-slot--active circle {
    animation: none;
  }

  .wd-node--beckon .wd-node-shape {
    animation: none;
  }
  .wd-target-marker-shape {
    animation: none;
  }
  .wd-line--active {
    transition-duration: 0.01s;
    transition-delay: 0s !important;
  }
  .wd-flow-particle {
    display: none;
  }
  .wd-node--charged .wd-node-shape {
    animation: none;
  }
  .wd-node--entering,
  .wd-node--entering .wd-node-shape,
  .wd-line--entering,
  .wd-backdrop {
    animation: none;
  }
  .wd-direction-arrow-shaft {
    animation: none;
  }
  .wd-node-label {
    transition-duration: 0.01s;
  }
  .wd-firework-shell {
    display: none;
  }
  .wd-map-caption {
    transition-duration: 0.01s;
  }
  .wd-mascot-avatar.wd-mascot--talking,
  .wd-mascot-avatar.wd-mascot--celebrating {
    animation: none;
  }
  .wd-mascot--arriving .wd-mascot-avatar.wd-mascot--celebrating {
    animation: none;
  }
  .wd-mascot {
    transition-duration: 0.01s;
  }
  .wd-mascot-caption,
  .wd-mascot-dialog {
    transition-duration: 0.01s;
  }
}
`;

export function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
