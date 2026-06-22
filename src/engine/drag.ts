import { animateTo, type Point } from "./animate";
import type { DemoNode } from "../types";

export interface ConnectedLine {
  line: SVGLineElement;
  /** which end of the line corresponds to the dragged node */
  endpoint: "from" | "to";
}

export interface DragOptions {
  svg: SVGSVGElement;
  nodeGroup: SVGGElement;
  node: DemoNode;
  connectedLines: ConnectedLine[];
  onSnapSuccess: () => void;
}

const SNAP_DURATION_MS = 280;
const RETURN_DURATION_MS = 320;

function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): Point {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const inverse = ctm.inverse();
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(inverse);
  return { x: transformed.x, y: transformed.y };
}

function setNodePosition(nodeGroup: SVGGElement, connectedLines: ConnectedLine[], pos: Point): void {
  nodeGroup.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);
  for (const { line, endpoint } of connectedLines) {
    if (endpoint === "from") {
      line.setAttribute("x1", String(pos.x));
      line.setAttribute("y1", String(pos.y));
    } else {
      line.setAttribute("x2", String(pos.x));
      line.setAttribute("y2", String(pos.y));
    }
  }
}

export function attachDrag(options: DragOptions, snapThreshold: number): void {
  const { svg, nodeGroup, node, connectedLines, onSnapSuccess } = options;
  const startPos: Point = node.start ?? { x: node.x, y: node.y };
  const targetPos: Point = { x: node.x, y: node.y };

  let pointerOffset: Point = { x: 0, y: 0 };
  let currentPos: Point = { ...startPos };

  function onPointerMove(event: PointerEvent): void {
    const svgPoint = toSvgPoint(svg, event.clientX, event.clientY);
    currentPos = { x: svgPoint.x - pointerOffset.x, y: svgPoint.y - pointerOffset.y };
    setNodePosition(nodeGroup, connectedLines, currentPos);
  }

  function onPointerUp(event: PointerEvent): void {
    nodeGroup.removeEventListener("pointermove", onPointerMove);
    nodeGroup.removeEventListener("pointerup", onPointerUp);
    nodeGroup.removeEventListener("pointercancel", onPointerUp);
    nodeGroup.releasePointerCapture(event.pointerId);

    const distance = Math.hypot(currentPos.x - targetPos.x, currentPos.y - targetPos.y);
    const snapped = distance <= snapThreshold;
    const destination = snapped ? targetPos : startPos;
    const duration = snapped ? SNAP_DURATION_MS : RETURN_DURATION_MS;

    animateTo(
      currentPos,
      destination,
      duration,
      (point) => setNodePosition(nodeGroup, connectedLines, point),
      () => {
        currentPos = destination;
        if (snapped) {
          onSnapSuccess();
        }
      },
    );
  }

  nodeGroup.addEventListener("pointerdown", (event: PointerEvent) => {
    nodeGroup.classList.remove("wd-node--beckon");
    nodeGroup.setPointerCapture(event.pointerId);

    const svgPoint = toSvgPoint(svg, event.clientX, event.clientY);
    pointerOffset = { x: svgPoint.x - currentPos.x, y: svgPoint.y - currentPos.y };

    nodeGroup.addEventListener("pointermove", onPointerMove);
    nodeGroup.addEventListener("pointerup", onPointerUp);
    nodeGroup.addEventListener("pointercancel", onPointerUp);
  });
}
