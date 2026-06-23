import { animateTo, type Point } from "./animate";
import type { DemoNode } from "../types";

export interface ConnectedLine {
  line: SVGLineElement;
  /** which end of the line corresponds to the dragged node */
  endpoint: "from" | "to";
}

export interface RevealTarget {
  element: SVGElement;
  /** opacity once fully revealed but not yet snapped (1 for nodes, 0.5 for muted/dashed lines) */
  baseOpacity: number;
}

export interface DragOptions {
  svg: SVGSVGElement;
  nodeGroup: SVGGElement;
  node: DemoNode;
  connectedLines: ConnectedLine[];
  revealTargets: RevealTarget[];
  onSnapSuccess: () => void;
  /** if provided, the drag must be picked up from this element (e.g. a toolbox slot) instead of the node itself */
  externalHandle?: HTMLElement;
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

/** 0 at start, 1 once the dragged node has reached its target */
function computeRevealProgress(pos: Point, start: Point, target: Point): number {
  const total = Math.hypot(target.x - start.x, target.y - start.y);
  if (total === 0) return 1;
  const remaining = Math.hypot(target.x - pos.x, target.y - pos.y);
  const raw = 1 - remaining / total;
  return Math.min(1, Math.max(0, raw));
}

function applyReveal(progress: number, revealTargets: RevealTarget[]): void {
  for (const { element, baseOpacity } of revealTargets) {
    element.style.opacity = String(progress * baseOpacity);
  }
}

function clearRevealOverride(revealTargets: RevealTarget[]): void {
  for (const { element } of revealTargets) {
    element.style.opacity = "";
  }
}

export function attachDrag(options: DragOptions, snapThreshold: number): void {
  const { svg, nodeGroup, node, connectedLines, revealTargets, onSnapSuccess, externalHandle } = options;
  const startPos: Point = node.start ?? { x: node.x, y: node.y };
  const targetPos: Point = { x: node.x, y: node.y };
  const triggerElement: HTMLElement | SVGGElement = externalHandle ?? nodeGroup;

  let currentPos: Point = { ...startPos };

  function onPointerMove(event: PointerEvent): void {
    currentPos = toSvgPoint(svg, event.clientX, event.clientY);
    setNodePosition(nodeGroup, connectedLines, currentPos);
    applyReveal(computeRevealProgress(currentPos, startPos, targetPos), revealTargets);
  }

  function onPointerUp(event: PointerEvent): void {
    triggerElement.removeEventListener("pointermove", onPointerMove as EventListener);
    triggerElement.removeEventListener("pointerup", onPointerUp as EventListener);
    triggerElement.removeEventListener("pointercancel", onPointerUp as EventListener);
    triggerElement.releasePointerCapture(event.pointerId);

    const distance = Math.hypot(currentPos.x - targetPos.x, currentPos.y - targetPos.y);
    const snapped = distance <= snapThreshold;
    const destination = snapped ? targetPos : startPos;
    const duration = snapped ? SNAP_DURATION_MS : RETURN_DURATION_MS;

    animateTo(
      currentPos,
      destination,
      duration,
      (point) => {
        setNodePosition(nodeGroup, connectedLines, point);
        applyReveal(computeRevealProgress(point, startPos, targetPos), revealTargets);
      },
      () => {
        currentPos = destination;
        if (snapped) {
          clearRevealOverride(revealTargets);
          onSnapSuccess();
        } else if (externalHandle) {
          nodeGroup.style.opacity = "0";
        }
      },
    );
  }

  triggerElement.addEventListener("pointerdown", ((event: PointerEvent) => {
    nodeGroup.classList.remove("wd-node--beckon");
    triggerElement.setPointerCapture(event.pointerId);

    if (externalHandle) {
      currentPos = toSvgPoint(svg, event.clientX, event.clientY);
      nodeGroup.style.opacity = "1";
      setNodePosition(nodeGroup, connectedLines, currentPos);
    }

    triggerElement.addEventListener("pointermove", onPointerMove as EventListener);
    triggerElement.addEventListener("pointerup", onPointerUp as EventListener);
    triggerElement.addEventListener("pointercancel", onPointerUp as EventListener);
  }) as EventListener);
}
