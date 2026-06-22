const STYLE_ID = "wardley-demo-styles";

const CSS = `
.wardley-demo-root {
  --wd-color-ink: #1a1a1a;
  --wd-color-link: #005f99;
  --wd-color-link-hover: #003d6b;
  --wd-color-border: #e5e5e5;
  --wd-color-bg-soft: #f5f5f5;
  --wd-color-stage-3: #2d6648;
  --wd-font-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  display: block;
  width: 100%;
}

.wardley-demo-root svg {
  display: block;
  width: 100%;
  height: auto;
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

.wd-line {
  stroke: #999;
  stroke-width: 1.5;
  stroke-dasharray: 4 4;
  opacity: 0.5;
  transition: stroke 0.3s ease, opacity 0.3s ease, stroke-width 0.3s ease;
}

.wd-line--active {
  stroke: var(--wd-color-link, #005f99);
  stroke-width: 2.5;
  stroke-dasharray: none;
  opacity: 1;
}

.wd-line--active:nth-of-type(2) { transition-delay: 0.08s; }
.wd-line--active:nth-of-type(3) { transition-delay: 0.16s; }

@media (prefers-reduced-motion: reduce) {
  .wd-node--beckon .wd-node-shape {
    animation: none;
  }
  .wd-line {
    transition-duration: 0.01s;
    transition-delay: 0s !important;
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
