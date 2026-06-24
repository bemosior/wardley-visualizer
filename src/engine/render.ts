import type { DemoConnection, DemoNode } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";
export const NODE_RADIUS = 28;

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

/** shrinks a label's rendered width to fit inside its node if it would otherwise overflow; leaves short labels untouched */
export function fitNodeLabel(label: SVGTextElement, radius: number = NODE_RADIUS): void {
  const maxWidth = radius * 2 - LABEL_PADDING;
  const actualWidth = label.getComputedTextLength();
  if (actualWidth > maxWidth) {
    label.setAttribute("textLength", String(maxWidth));
    label.setAttribute("lengthAdjust", "spacingAndGlyphs");
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

const FIREWORK_PARTICLE_COUNT = 14;
const FIREWORK_COLOR_CLASSES = ["wd-firework-particle--a", "wd-firework-particle--b", "wd-firework-particle--c"];

/**
 * one-shot celebratory burst centered on (x, y): returns a single <g> containing
 * FIREWORK_PARTICLE_COUNT small circles, each animating outward to a randomized
 * angle/distance via a CSS custom property and fading out. Caller appends it once
 * (on top of everything else) and is responsible for removing it once finished.
 */
export function createFireworkBurst(x: number, y: number): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.classList.add("wd-firework");
  g.setAttribute("transform", `translate(${x}, ${y})`);

  for (let i = 0; i < FIREWORK_PARTICLE_COUNT; i++) {
    const angle = (i / FIREWORK_PARTICLE_COUNT) * 360 + (Math.random() * 16 - 8);
    const distance = 32 + Math.random() * 26;
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians) * distance;
    const dy = Math.sin(radians) * distance;

    const particle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
    particle.classList.add("wd-firework-particle", FIREWORK_COLOR_CLASSES[i % FIREWORK_COLOR_CLASSES.length]);
    particle.setAttribute("r", "2.5");
    particle.style.setProperty("--wd-fw-dx", `${dx}`);
    particle.style.setProperty("--wd-fw-dy", `${dy}`);
    particle.style.animationDelay = `${Math.random() * 0.1}s`;
    g.appendChild(particle);
  }

  return g;
}
