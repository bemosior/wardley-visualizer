const STYLE_ID = "wardley-demo-styles";

const CSS = `
.wardley-demo-root {
  --wd-color-ink: #1a1a1a;
  --wd-color-link: #005f99;
  --wd-color-link-hover: #003d6b;
  --wd-color-border: #e5e5e5;
  --wd-color-bg-soft: #f5f5f5;
  --wd-color-stage-3: #2d6648;
  --wd-color-flow: #7ec8ff;
  --wd-font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
  animation: wd-particle-travel 1.8s linear infinite;
}

@keyframes wd-particle-travel {
  0% { offset-distance: 100%; opacity: 0; }
  10% { opacity: 1; }
  85% { opacity: 1; }
  100% { offset-distance: 0%; opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
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
}
`;

export function injectStylesOnce(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
