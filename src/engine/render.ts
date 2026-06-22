import type { DemoConnection, DemoNode } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";

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
  shape.setAttribute("r", "28");
  shape.classList.add("wd-node-shape");
  g.appendChild(shape);

  const label = document.createElementNS(SVG_NS, "text");
  label.classList.add("wd-node-label");
  label.textContent = node.label;
  g.appendChild(label);

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
