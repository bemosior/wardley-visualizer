import type { DemoConnection, DemoNode } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";
export const NODE_RADIUS = 48;

export function createSvgRoot(viewBox: { width: number; height: number }): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("role", "img");
  return svg;
}

export function createNodeGroup(node: DemoNode): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.dataset.nodeId = node.id;
  g.classList.add("wd-node");
  if (node.draggable) {
    g.classList.add("wd-node--draggable");
  }

  const pos = node.draggable && node.start ? node.start : { x: node.x, y: node.y };
  g.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);

  const shape = document.createElementNS(SVG_NS, "circle");
  shape.setAttribute("r", String(NODE_RADIUS));
  shape.classList.add("wd-node-shape");
  g.appendChild(shape);

  const label = document.createElementNS(SVG_NS, "text");
  label.classList.add("wd-node-label");
  label.textContent = node.label;
  g.appendChild(label);

  return g;
}

const LABEL_PADDING = 12;
const LABEL_MIN_FONT_SIZE = 9;

/** shrinks a label's font-size to fit inside its node if it would otherwise overflow; leaves short labels untouched */
export function fitNodeLabel(label: SVGTextElement, radius: number = NODE_RADIUS): void {
  const maxWidth = radius * 2 - LABEL_PADDING;
  const actualWidth = label.getComputedTextLength();
  if (actualWidth > maxWidth) {
    const currentFontSize = parseFloat(getComputedStyle(label).fontSize);
    const fittedFontSize = Math.max(LABEL_MIN_FONT_SIZE, currentFontSize * (maxWidth / actualWidth));
    label.style.fontSize = `${fittedFontSize}px`;
  }
}

export function createTargetMarker(node: DemoNode): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.classList.add("wd-target-marker");
  g.setAttribute("transform", `translate(${node.x}, ${node.y})`);

  const shape = document.createElementNS(SVG_NS, "circle");
  shape.setAttribute("r", String(NODE_RADIUS));
  shape.classList.add("wd-target-marker-shape");
  g.appendChild(shape);

  return g;
}

export function createConnectionLine(
  conn: DemoConnection,
  nodesById: Map<string, DemoNode>,
): SVGLineElement {
  const line = document.createElementNS(SVG_NS, "line") as SVGLineElement;
  line.classList.add("wd-line");
  line.dataset.from = conn.from;
  line.dataset.to = conn.to;
  line.style.opacity = "0";

  const from = nodesById.get(conn.from)!;
  const to = nodesById.get(conn.to)!;
  const fromPos = from.draggable && from.start ? from.start : { x: from.x, y: from.y };
  const toPos = to.draggable && to.start ? to.start : { x: to.x, y: to.y };

  line.setAttribute("x1", String(fromPos.x));
  line.setAttribute("y1", String(fromPos.y));
  line.setAttribute("x2", String(toPos.x));
  line.setAttribute("y2", String(toPos.y));

  return line;
}

const FLOW_PARTICLE_COUNT = 1;
const FLOW_PARTICLE_RADIUS = "4.5";

/**
 * decorative traveling-spark overlay for a completed connection: returns FLOW_PARTICLE_COUNT
 * <circle> elements, each riding the from->to line via CSS offset-path. Only ever created
 * post-snap, so final x/y is always correct. Caller is responsible for animation-delay
 * (depends on both connection index and particle index) and DOM insertion order.
 */
export function createFlowParticles(
  conn: DemoConnection,
  nodesById: Map<string, DemoNode>,
): SVGCircleElement[] {
  const from = nodesById.get(conn.from)!;
  const to = nodesById.get(conn.to)!;
  const path = `path("M ${from.x},${from.y} L ${to.x},${to.y}")`;

  const particles: SVGCircleElement[] = [];
  for (let i = 0; i < FLOW_PARTICLE_COUNT; i++) {
    const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
    circle.classList.add("wd-flow-particle");
    circle.dataset.from = conn.from;
    circle.dataset.to = conn.to;
    circle.setAttribute("r", FLOW_PARTICLE_RADIUS);
    circle.style.offsetPath = path;
    particles.push(circle);
  }
  return particles;
}

const FIREWORK_SHELL_COUNT = 3;
const FIREWORK_SPARKS_PER_SHELL = 24;
const FIREWORK_COLORS = ["#f4b942", "#ff6b6b", "#005f99", "#7ec8ff", "#ffffff"];

/** comma-separated box-shadow list: one dot per angle, all at the same `spread` distance from center */
function buildSparkShadowList(angles: number[], spread: number): string {
  return angles
    .map((angle, i) => {
      const dx = Math.cos(angle) * spread;
      const dy = Math.sin(angle) * spread;
      const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
      return `${dx.toFixed(1)}px ${dy.toFixed(1)}px 0 1px ${color}`;
    })
    .join(", ");
}

/**
 * one-shot celebratory firework: returns FIREWORK_SHELL_COUNT plain <div> "shells", each
 * positioned (via CSS left/top in pixels, relative to whatever positioned ancestor the
 * caller appends them into) near (pxX, pxY). Each shell is a single tiny element whose
 * box-shadow list animates from a tightly clustered set of dots to a spread-out set with
 * the same count/order, so the browser interpolates every dot's position+color smoothly —
 * the classic CSS "box-shadow particle burst" technique, giving a rich multi-spark explosion
 * from one DOM node per shell rather than one node per spark. Caller appends them once (on
 * top of everything else) and is responsible for removing them when done.
 */
export function createFireworkShells(pxX: number, pxY: number): HTMLDivElement[] {
  const shells: HTMLDivElement[] = [];
  for (let s = 0; s < FIREWORK_SHELL_COUNT; s++) {
    const shell = document.createElement("div");
    shell.className = "wd-firework-shell";
    shell.style.left = `${pxX + (Math.random() * 24 - 12)}px`;
    shell.style.top = `${pxY + (Math.random() * 24 - 12)}px`;

    const angles = Array.from(
      { length: FIREWORK_SPARKS_PER_SHELL },
      (_, i) => (i / FIREWORK_SPARKS_PER_SHELL) * Math.PI * 2 + (Math.random() * 0.3 - 0.15),
    );
    const finalSpread = 26 + Math.random() * 14;
    shell.style.setProperty("--wd-fw-start", buildSparkShadowList(angles, 2));
    shell.style.setProperty("--wd-fw-end", buildSparkShadowList(angles, finalSpread));
    shell.style.animationDelay = `${s * 0.18}s`;
    shells.push(shell);
  }
  return shells;
}
