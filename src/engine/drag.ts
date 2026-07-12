import { animateTo, type Point } from "./animate";
import type { DemoNode } from "./types";

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

export function setNodePosition(nodeGroup: SVGGElement, connectedLines: ConnectedLine[], pos: Point): void {
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

export interface DragHandle {
  /**
   * marks this drag as completed and detaches its own pointerdown listener, without a real
   * pointer gesture — for a completion driven some other way (`WardleyDemo.skipDrag()`). Without
   * this, the listener this function attached stays live forever (its internal `completed` flag
   * never flips true on its own), so a later real drag on the same element -- e.g. Phase 20's
   * evolution-axis drag reusing the Need's node group -- still triggers *this* handler's own
   * pointerup too, sees the drop as "missed the snap target", and animates the node back to its
   * pre-drag `start` position using this call's own (by-then stale) `connectedLines` snapshot.
   */
  skipDrag: () => void;
}

export function attachDrag(options: DragOptions, snapThreshold: number): DragHandle {
  const { svg, nodeGroup, node, connectedLines, revealTargets, onSnapSuccess, externalHandle } = options;
  const startPos: Point = node.start ?? { x: node.x, y: node.y };
  const targetPos: Point = { x: node.x, y: node.y };
  const triggerElement: HTMLElement | SVGGElement = externalHandle ?? nodeGroup;

  let currentPos: Point = { ...startPos };
  let completed = false;

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
          completed = true;
          clearRevealOverride(revealTargets);
          onSnapSuccess();
        } else if (externalHandle) {
          nodeGroup.style.opacity = "0";
        }
      },
    );
  }

  const onPointerDown = ((event: PointerEvent) => {
    if (completed) return;
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
  }) as EventListener;
  triggerElement.addEventListener("pointerdown", onPointerDown);

  return {
    skipDrag() {
      completed = true;
      triggerElement.removeEventListener("pointerdown", onPointerDown);
    },
  };
}

export interface AxisDragOptions {
  svg: SVGSVGElement;
  nodeGroup: SVGGElement;
  node: DemoNode;
  connectedLines: ConnectedLine[];
  /** clamp bounds (viewBox units) for the node's x while dragging */
  minX: number;
  maxX: number;
  /** fires with the clamped x on every pointer move */
  onPositionChange?: (x: number) => void;
  /** fires once, the first time the node is dropped (pointer released) — used to reveal a confirm control only after the visitor has actually tried dragging */
  onFirstRelease?: () => void;
  /** fires on every pointerdown, before anything else -- lets the caller cancel a still-in-flight animation (e.g. `slideToGenesis`) that would otherwise keep fighting this drag for the node's position */
  onDragStart?: () => void;
}

export interface AxisDragHandle {
  /** locks the node's x to wherever it currently sits, detaches the drag listener, and calls `onConfirm` with that x */
  confirm: (onConfirm: (x: number) => void) => void;
  /** fires `onFirstRelease` immediately without a real drag — for autopilot/testing */
  skipDrag: () => void;
}

/**
 * free horizontal drag along a fixed y, with no snap-to-point and no
 * auto-commit on release — the node stays wherever it's dropped (clamped to
 * `[minX, maxX]`) and stays draggable until `confirm()` is called. This is a
 * different interaction mode than `attachDrag`'s snap-to-target, not a
 * parameterization of it (Phase 20's evolution-axis placement: free movement,
 * live feedback, then an explicit confirm action).
 */
export function attachAxisDrag(options: AxisDragOptions): AxisDragHandle {
  const { svg, nodeGroup, node, connectedLines, minX, maxX, onPositionChange, onFirstRelease, onDragStart } = options;

  let currentX = node.x;
  let hasMoved = false;
  let hasReleasedOnce = false;
  let confirmed = false;

  function clamp(x: number): number {
    return Math.min(maxX, Math.max(minX, x));
  }

  function onPointerMove(event: PointerEvent): void {
    const point = toSvgPoint(svg, event.clientX, event.clientY);
    currentX = clamp(point.x);
    hasMoved = true;
    setNodePosition(nodeGroup, connectedLines, { x: currentX, y: node.y });
    onPositionChange?.(currentX);
  }

  function onPointerUp(event: PointerEvent): void {
    nodeGroup.removeEventListener("pointermove", onPointerMove as EventListener);
    nodeGroup.removeEventListener("pointerup", onPointerUp as EventListener);
    nodeGroup.removeEventListener("pointercancel", onPointerUp as EventListener);
    nodeGroup.releasePointerCapture(event.pointerId);

    if (!hasReleasedOnce) {
      hasReleasedOnce = true;
      onFirstRelease?.();
    }
  }

  function onPointerDown(event: PointerEvent): void {
    if (confirmed) return;
    onDragStart?.();
    nodeGroup.classList.remove("wd-node--beckon");
    nodeGroup.setPointerCapture(event.pointerId);
    nodeGroup.addEventListener("pointermove", onPointerMove as EventListener);
    nodeGroup.addEventListener("pointerup", onPointerUp as EventListener);
    nodeGroup.addEventListener("pointercancel", onPointerUp as EventListener);
  }

  nodeGroup.addEventListener("pointerdown", onPointerDown as EventListener);

  return {
    confirm(onConfirm) {
      confirmed = true;
      nodeGroup.removeEventListener("pointerdown", onPointerDown as EventListener);
      // currentX was only ever set once, at attachAxisDrag's own setup time -- if the node was
      // never actually dragged (a tap that just reveals the confirm control, or autopilot's
      // skipDrag), that snapshot predates any concurrent slideToGenesis animation finishing or
      // being cancelled, so it's stale. Re-read node.x here instead: onDragStart (fired on the
      // tap that got us here) already resolved node.x to wherever the node actually sits.
      if (!hasMoved) currentX = node.x;
      node.x = currentX;
      // re-stamps the <g>'s transform and connectedLines from currentX, same as every other
      // write to the node's position in this file (onPointerMove, skipDrag's caller) -- without
      // this, a confirm that isn't preceded by a real onPointerMove (e.g. a tap with no drag
      // motion, or a pointercancel) leaves the node's on-screen position wherever it last was
      // rendered by something else (mount, or a concurrent slideToGenesis animation), silently
      // out of sync with the x this just committed to `node.x` and handed to `onConfirm` below.
      setNodePosition(nodeGroup, connectedLines, { x: currentX, y: node.y });
      onConfirm(currentX);
    },
    skipDrag() {
      if (!hasReleasedOnce) {
        hasReleasedOnce = true;
        onFirstRelease?.();
      }
    },
  };
}
