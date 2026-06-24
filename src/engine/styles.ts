const STYLE_ID = "wardley-demo-styles";

const CSS = `
.wardley-demo-root,
.wd-panel {
  --wd-color-ink: #1a1a1a;
  --wd-color-link: #005f99;
  --wd-color-link-hover: #003d6b;
  --wd-color-border: #e5e5e5;
  --wd-color-bg-soft: #f5f5f5;
  --wd-color-stage-3: #2d6648;
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
}

.wd-node--draggable {
  cursor: grab;
  touch-action: none;
}

.wd-node--draggable:active {
  cursor: grabbing;
}

.wd-node--beckon .wd-node-shape {
  animation: wd-pulse 1.8s ease-in-out infinite;
}

@keyframes wd-pulse {
  0%, 100% { filter: drop-shadow(0 0 0 rgba(0, 95, 153, 0)); }
  50% { filter: drop-shadow(0 0 8px rgba(0, 95, 153, 0.55)); }
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
  animation: wd-particle-travel 2.0s linear infinite;
}

@keyframes wd-particle-travel {
  0% { offset-distance: 100%; opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  100% { offset-distance: 0%; opacity: 0; }
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
  font-size: 11px;
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
  .wd-firework-shell {
    display: none;
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
