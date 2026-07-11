const STYLE_ID = "wardley-demo-styles";

/**
 * shared floor for both `.wd-panel-content`'s CSS min-height and `showMapBackdrop`'s
 * `targetHeightPx` argument (see `userNeedDependency.ts`) — keeps the map's reserved height in
 * sync with the panel/mascot-bubble content it needs to avoid overlapping, without either side
 * reading the other's live DOM size.
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

/** hides a node's label (Phase 0's opening beat, before the visitor commits via "Let's begin!") — opacity, not visibility, so the fade transition above applies */
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

/* the floating mascot bubble should hug its content rather than reserve a fixed height across
   mode switches, unlike the base .wd-panel-content rule above */
.wd-mascot-bubble .wd-panel-content {
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
 * host-supplied overlay a Mascot mounts into -- must be a child of the same element passed to
 * WardleyDemo.mount as its container (not a sibling positioned elsewhere in the page), sized to
 * cover it exactly, so WardleyDemo.getNodePixelPosition's coordinates (measured relative to
 * that same container's top-left, the same space fireworkAt already renders into) line up
 * pixel-for-pixel with .wd-mascot's left/top. pointer-events: none lets clicks fall through to
 * the map/nodes underneath everywhere. .wd-mascot itself stays pointer-events: none too (its flex
 * box spans avatar-to-bubble, including the empty gap between them, which would otherwise sit on
 * top of and block dragging any node that box happens to cover) -- only .wd-mascot-bubble
 * re-enables pointer events, since it's the one piece that's actually interactive.
 */
.wd-mascot-host {
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
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  pointer-events: none;
  transition: left 0.4s ease, top 0.4s ease;
  /* an absolutely-positioned box with only 'left' set (no 'width'/'right') shrink-to-fits against
     containing-block-width-minus-left -- fine when 'left' sits well inside the canvas, but once
     it's near the host's right edge (mascot.ts's moveToTopRight) that leaves almost no room,
     forcing the bubble to wrap its text into a narrow column before its own flip/left offset
     (which doesn't feed back into this box's size) shifts it back out, stranding the tail on that
     now-narrow box far from the avatar. An explicit max-content width instead sizes this row off
     its children's own natural widths, independent of where 'left' puts it -- the bubble's own
     280px max-width still caps how wide it can grow. */
  width: max-content;
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
    wd-mascot-arrive 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    wd-node-charged 2.4s ease-in-out infinite,
    wd-mascot-celebrate 0.8s ease-in-out 0.2s;
}

@keyframes wd-mascot-arrive {
  0% {
    opacity: 0;
    transform: scale(0.4);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.wd-mascot--arriving .wd-mascot-bubble {
  opacity: 0;
}

.wd-mascot-bubble {
  position: relative;
  background: #fff;
  border: 1px solid var(--wd-color-border);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 0.75rem 1rem;
  max-width: 280px;
  pointer-events: auto;
  opacity: 1;
  transition: opacity 0.4s ease;
}

.wd-mascot-bubble::before {
  content: "";
  position: absolute;
  left: -8px;
  top: var(--wd-tail-top, 20px);
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid var(--wd-color-border);
}

.wd-mascot-bubble::after {
  content: "";
  position: absolute;
  left: -7px;
  top: var(--wd-tail-top, 20px);
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-right: 8px solid #fff;
}

/* mascot.ts's clampBubbleHorizontally adds this once the bubble has flipped to the avatar's left side (no
   room on the right) — moves the speech-bubble tail to the opposite edge so it still points at
   the avatar instead of out into empty canvas */
.wd-mascot-bubble--flip::before {
  left: auto;
  right: -8px;
  border-right: none;
  border-left: 8px solid var(--wd-color-border);
}

.wd-mascot-bubble--flip::after {
  left: auto;
  right: -7px;
  border-right: none;
  border-left: 8px solid #fff;
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
  .wd-mascot-bubble {
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
