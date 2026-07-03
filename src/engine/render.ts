import { EVOLUTION_STAGES, type EvolutionStage } from "../domain/evolution";
import type { DemoConnection, DemoNode } from "./types";

const SVG_NS = "http://www.w3.org/2000/svg";
export const NODE_RADIUS = 48;

export function createSvgRoot(viewBox: { width: number; height: number }): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("role", "img");
  return svg;
}

/** a plain <g> grouping element, used to keep the scene's z-order stable as nodes/connections are added incrementally */
export function createLayer(): SVGGElement {
  return document.createElementNS(SVG_NS, "g") as SVGGElement;
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

const CHEVRON_GAP = 14;
const CHEVRON_HALF_WIDTH = 5;
const CHEVRON_HALF_HEIGHT = 9;

/**
 * a small "drag me this way" arrow flanking an evolution-draggable node, nudging toward `direction`
 * to cue that the node can be dragged along the evolution axis. Positioned relative to the node's
 * own transform (so it rides along automatically as the node moves) — the caller is responsible for
 * appending it into the node's group and toggling `wd-node-chevron--hidden` once the node reaches
 * that side's edge of the axis.
 */
export function createEvolutionChevron(direction: "left" | "right", radius: number = NODE_RADIUS): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.classList.add("wd-node-chevron", `wd-node-chevron--${direction}`);
  const offsetX = direction === "right" ? radius + CHEVRON_GAP : -(radius + CHEVRON_GAP);
  g.setAttribute("transform", `translate(${offsetX}, 0)`);

  const tipX = direction === "right" ? CHEVRON_HALF_WIDTH : -CHEVRON_HALF_WIDTH;
  const backX = -tipX;
  const mark = document.createElementNS(SVG_NS, "path");
  mark.classList.add("wd-node-chevron-mark");
  mark.setAttribute(
    "d",
    `M ${backX},${-CHEVRON_HALF_HEIGHT} L ${tipX},0 L ${backX},${CHEVRON_HALF_HEIGHT}`,
  );
  g.appendChild(mark);

  return g;
}

const LABEL_PADDING = 12;
const LABEL_MIN_FONT_SIZE = 9;

/** measures the rendered width of `text` as a tspan of `label`, without disturbing label's existing content */
function measureTspanWidth(label: SVGTextElement, text: string): number {
  const tspan = document.createElementNS(SVG_NS, "tspan");
  tspan.textContent = text;
  label.appendChild(tspan);
  const width = tspan.getComputedTextLength();
  label.removeChild(tspan);
  return width;
}

/** greedily wraps `words` into the fewest lines that each fit within maxWidth, at label's current font size */
function wrapWords(label: SVGTextElement, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && measureTspanWidth(label, candidate) > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * fits a label inside its node, first by word-wrapping it onto multiple centered lines, falling back
 * to shrinking the font-size (the original behavior) only if wrapping can't make it fit. Leaves
 * short labels untouched.
 */
export function fitNodeLabel(label: SVGTextElement, radius: number = NODE_RADIUS): void {
  const maxWidth = radius * 2 - LABEL_PADDING;
  const originalText = label.textContent ?? "";
  if (label.getComputedTextLength() <= maxWidth) return;

  const words = originalText.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    label.textContent = "";
    const lineHeight = parseFloat(getComputedStyle(label).fontSize) * 1.2;
    const maxLines = Math.max(1, Math.floor((radius * 2 - LABEL_PADDING) / lineHeight));
    const lines = wrapWords(label, words, maxWidth);
    const fits =
      lines.length > 1 && lines.length <= maxLines && lines.every((line) => measureTspanWidth(label, line) <= maxWidth);

    if (fits) {
      const startDy = -((lines.length - 1) / 2) * lineHeight;
      lines.forEach((line, i) => {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.textContent = line;
        tspan.setAttribute("x", label.getAttribute("x") ?? "0");
        tspan.setAttribute("dy", `${i === 0 ? startDy : lineHeight}`);
        label.appendChild(tspan);
      });
      return;
    }

    label.textContent = originalText;
  }

  const actualWidth = label.getComputedTextLength();
  if (actualWidth > maxWidth) {
    const currentFontSize = parseFloat(getComputedStyle(label).fontSize);
    const fittedFontSize = Math.max(LABEL_MIN_FONT_SIZE, currentFontSize * (maxWidth / actualWidth));
    label.style.fontSize = `${fittedFontSize}px`;
  }
}

const EVOLUTION_STAGE_CLASSES = ["genesis", "custom", "product", "commodity"] as const;
const BACKDROP_LABEL_INSET = 14;

/**
 * the four evolution-axis stage bands + dividers + labels, rendered behind everything else.
 * Spans the full viewBox so every node in the value chain (User down through Capabilities) sits
 * on the map, not just a clipped slice of it — the viewBox itself, not this function, is what
 * should stay landscape-shaped if that's a goal.
 */
/** x-coordinate of the center of the Genesis column (the leftmost evolution-stage band) for a given viewBox width — shares the band math with `createMapBackdrop` rather than duplicating it in callers that need to position a node within that column. */
export function genesisCenterX(viewBoxWidth: number): number {
  return viewBoxWidth / EVOLUTION_STAGES.length / 2;
}

/** which evolution-stage band an x-coordinate falls into, for a given viewBox width — shares the same band math as `createMapBackdrop` so a dragged node's live position always agrees with the band it visibly sits on. Clamps to the first/last stage for out-of-range x. */
export function stageLabelAt(x: number, viewBoxWidth: number): EvolutionStage {
  const bandWidth = viewBoxWidth / EVOLUTION_STAGES.length;
  const index = Math.min(EVOLUTION_STAGES.length - 1, Math.max(0, Math.floor(x / bandWidth)));
  return EVOLUTION_STAGES[index];
}

export function createMapBackdrop(viewBox: { width: number; height: number }): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.classList.add("wd-backdrop");

  const bandWidth = viewBox.width / EVOLUTION_STAGES.length;

  EVOLUTION_STAGES.forEach((stage, i) => {
    const x = i * bandWidth;

    const band = document.createElementNS(SVG_NS, "rect");
    band.classList.add("wd-backdrop-band", `wd-backdrop-band--${EVOLUTION_STAGE_CLASSES[i]}`);
    band.setAttribute("x", String(x));
    band.setAttribute("y", "0");
    band.setAttribute("width", String(bandWidth));
    band.setAttribute("height", String(viewBox.height));
    g.appendChild(band);

    if (i > 0) {
      const divider = document.createElementNS(SVG_NS, "line");
      divider.classList.add("wd-backdrop-divider");
      divider.setAttribute("x1", String(x));
      divider.setAttribute("y1", "0");
      divider.setAttribute("x2", String(x));
      divider.setAttribute("y2", String(viewBox.height));
      g.appendChild(divider);
    }

    const label = document.createElementNS(SVG_NS, "text");
    label.classList.add("wd-backdrop-label");
    label.textContent = stage;
    label.setAttribute("x", String(x + bandWidth / 2));
    label.setAttribute("y", String(viewBox.height - BACKDROP_LABEL_INSET));
    g.appendChild(label);
  });

  return g;
}

const MAP_CAPTION_LINE_HEIGHT_EM = 1.3;

/**
 * a transient caption rendered over the map as it appears; positioned by the caller (e.g.
 * centered on the newly revealed area), faded in/out by `WardleyDemo`. `*word*`-delimited
 * segments of `text` render as italic `<tspan>`s (e.g. for term emphasis), everything else as
 * plain text. `\r?\n` line breaks in `text` (SVG ignores literal newlines in textContent, unlike
 * HTML with `white-space: pre`) split it into one `<tspan x dy>` per line instead, vertically
 * centered as a block around `y`. Single-line text skips that wrapper entirely and appends
 * segment tspans straight onto the `<text>` element, so `text-anchor: middle` keeps centering the
 * whole thing as one run, same as before line-wrapping existed.
 */
export function createMapCaption(text: string, x: number, y: number): SVGTextElement {
  const caption = document.createElementNS(SVG_NS, "text") as SVGTextElement;
  caption.classList.add("wd-map-caption");
  caption.setAttribute("x", String(x));
  caption.setAttribute("y", String(y));

  const appendSegments = (parent: SVGTextElement | SVGTSpanElement, line: string): void => {
    line.split(/\*(.+?)\*/g).forEach((segment, i) => {
      if (segment === "") return;
      const tspan = document.createElementNS(SVG_NS, "tspan");
      tspan.textContent = segment;
      if (i % 2 === 1) tspan.classList.add("wd-map-caption-em");
      parent.appendChild(tspan);
    });
  };

  const lines = text.split(/\r?\n/).filter((line) => line !== "");
  if (lines.length <= 1) {
    appendSegments(caption, text);
  } else {
    lines.forEach((line, lineIndex) => {
      const lineSpan = document.createElementNS(SVG_NS, "tspan");
      lineSpan.setAttribute("x", String(x));
      const dy =
        lineIndex === 0 ? -((lines.length - 1) / 2) * MAP_CAPTION_LINE_HEIGHT_EM : MAP_CAPTION_LINE_HEIGHT_EM;
      lineSpan.setAttribute("dy", `${dy}em`);
      appendSegments(lineSpan, line);
      caption.appendChild(lineSpan);
    });
  }

  return caption;
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

export interface AnnotationRect {
  xMin: number;
  xMax: number;
  tier: number;
}

const ANNOTATION_GAP_ABOVE_NODE = 14;
const ANNOTATION_HEIGHT = 22;
const ANNOTATION_TIER_GAP = 8;
const ANNOTATION_MAX_TIERS = 4;
const ANNOTATION_PADDING_X = 10;
const ANNOTATION_MIN_WIDTH = 60;
/** rough average glyph width at the annotation font size — good enough for layout spacing, not real typography */
const ANNOTATION_CHAR_WIDTH = 6.2;

/** estimated pixel width of an annotation's callout box for `text` — a character-count heuristic rather than real text measurement, since the callout isn't attached to the DOM yet when a caller needs to know how much room to reserve for overlap avoidance */
function estimateAnnotationWidth(text: string): number {
  return Math.max(ANNOTATION_MIN_WIDTH, text.length * ANNOTATION_CHAR_WIDTH + ANNOTATION_PADDING_X * 2);
}

/** vertical center of a callout at `tier` tiers above `nodeY` (tier 0 = closest to the node) */
function annotationCenterY(nodeY: number, tier: number): number {
  return nodeY - NODE_RADIUS - ANNOTATION_GAP_ABOVE_NODE - ANNOTATION_HEIGHT / 2 - tier * (ANNOTATION_HEIGHT + ANNOTATION_TIER_GAP);
}

/** the lowest tier at which a callout of `width` centered on `x` doesn't overlap any `placed` rect sharing that tier */
function findOpenTier(x: number, width: number, placed: AnnotationRect[]): number {
  const xMin = x - width / 2;
  const xMax = x + width / 2;
  for (let tier = 0; tier < ANNOTATION_MAX_TIERS; tier++) {
    const collides = placed.some((rect) => rect.tier === tier && xMin <= rect.xMax && xMax >= rect.xMin);
    if (!collides) return tier;
  }
  return ANNOTATION_MAX_TIERS - 1;
}

/**
 * a short text callout permanently anchored above a node: a leader line from the node's top edge
 * up to a small rounded box containing `text`. `placed` is every `AnnotationRect` already returned
 * by a previous call (for this or other nodes) — used to pick the lowest tier (vertical stacking
 * level, closest-to-node first) whose horizontal extent doesn't collide with an existing callout,
 * since two nodes can end up confirmed at very close x-positions on the evolution axis. Caller
 * appends the returned element and accumulates the returned rect for future calls.
 */
export function createAnnotation(
  node: DemoNode,
  text: string,
  placed: AnnotationRect[],
): { element: SVGGElement; rect: AnnotationRect } {
  const width = estimateAnnotationWidth(text);
  const tier = findOpenTier(node.x, width, placed);
  const centerY = annotationCenterY(node.y, tier);

  const g = document.createElementNS(SVG_NS, "g") as SVGGElement;
  g.classList.add("wd-annotation");

  const leader = document.createElementNS(SVG_NS, "line");
  leader.classList.add("wd-annotation-leader");
  leader.setAttribute("x1", String(node.x));
  leader.setAttribute("y1", String(node.y - NODE_RADIUS));
  leader.setAttribute("x2", String(node.x));
  leader.setAttribute("y2", String(centerY + ANNOTATION_HEIGHT / 2));
  g.appendChild(leader);

  const bg = document.createElementNS(SVG_NS, "rect");
  bg.classList.add("wd-annotation-bg");
  bg.setAttribute("x", String(node.x - width / 2));
  bg.setAttribute("y", String(centerY - ANNOTATION_HEIGHT / 2));
  bg.setAttribute("width", String(width));
  bg.setAttribute("height", String(ANNOTATION_HEIGHT));
  bg.setAttribute("rx", "6");
  g.appendChild(bg);

  const label = document.createElementNS(SVG_NS, "text");
  label.classList.add("wd-annotation-text");
  label.textContent = text;
  label.setAttribute("x", String(node.x));
  label.setAttribute("y", String(centerY));
  g.appendChild(label);

  return { element: g, rect: { xMin: node.x - width / 2, xMax: node.x + width / 2, tier } };
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

const FLOW_PARTICLE_RADIUS = 4.5;

interface FlowStageParams {
  /** how many particles ride the line at once */
  count: number;
  /** seconds for one particle to travel the full line */
  durationS: number;
  /** genesis/custom-built read as unreliable supply: irregular, stalling motion rather than a smooth glide */
  sputter: boolean;
}

/**
 * particle count/speed/regularity per evolution stage — the concrete form of the "genesis
 * sputters, commodity flows smoothly" requirement: a component early on the axis is supplied by
 * one slow, stalling particle; a commodity is supplied by a dense, fast, evenly-spaced stream.
 */
const FLOW_STAGE_PARAMS: Record<EvolutionStage, FlowStageParams> = {
  Genesis: { count: 1, durationS: 3.4, sputter: true },
  "Custom-Built": { count: 2, durationS: 2.6, sputter: true },
  Product: { count: 3, durationS: 1.9, sputter: false },
  Commodity: { count: 4, durationS: 1.3, sputter: false },
};

/** the look of a line whose `to` node hasn't been placed on the evolution axis yet (Phase 0/1, before Phase 2's map exists) — unchanged from the fixed count/duration this module used before stage-dependent flow existed */
const DEFAULT_FLOW_PARAMS: FlowStageParams = { count: 1, durationS: 2.0, sputter: false };

/** exposed so callers (e.g. `WardleyDemo`) can derive an even inter-particle stagger from the same count/duration `createFlowParticles` used. Omit `stage` for a node not yet placed on the evolution axis. */
export function flowParamsForStage(stage?: EvolutionStage): FlowStageParams {
  return stage ? FLOW_STAGE_PARAMS[stage] : DEFAULT_FLOW_PARAMS;
}

/**
 * decorative traveling-spark overlay for a completed connection: returns one <circle> per
 * `flowParamsForStage(stage).count`, each riding the from->to line via CSS offset-path. Only
 * ever created post-snap, so final x/y is always correct. Caller is responsible for
 * animation-delay (depends on both connection index and particle index) and DOM insertion order.
 */
export function createFlowParticles(
  conn: DemoConnection,
  nodesById: Map<string, DemoNode>,
  stage?: EvolutionStage,
): SVGCircleElement[] {
  const from = nodesById.get(conn.from)!;
  const to = nodesById.get(conn.to)!;
  const path = `path("M ${from.x},${from.y} L ${to.x},${to.y}")`;
  const radius = conn.from === "user" && conn.to === "need" ? FLOW_PARTICLE_RADIUS * 1.5 : FLOW_PARTICLE_RADIUS;
  const { count, durationS, sputter } = flowParamsForStage(stage);

  const particles: SVGCircleElement[] = [];
  for (let i = 0; i < count; i++) {
    const circle = document.createElementNS(SVG_NS, "circle") as SVGCircleElement;
    circle.classList.add("wd-flow-particle");
    if (sputter) circle.classList.add("wd-flow-particle--sputter");
    circle.dataset.from = conn.from;
    circle.dataset.to = conn.to;
    circle.setAttribute("r", String(radius));
    circle.style.offsetPath = path;
    circle.style.animationDuration = `${durationS}s`;
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
