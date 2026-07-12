import type { Point } from "./animate";

/** an axis-aligned box in the same pixel space as `WardleyDemo.getNodePixelPosition` / the mascot's own `left`/`top` */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Circle extends Point {
  radius: number;
}

export interface Segment {
  a: Point;
  b: Point;
}

export function rectFromCenter(center: Point, width: number, height: number): Rect {
  const hw = width / 2;
  const hh = height / 2;
  return { left: center.x - hw, top: center.y - hh, right: center.x + hw, bottom: center.y + hh };
}

/** translates every edge of `rect` by `dx`/`dy`, keeping its size fixed */
export function shiftRect(rect: Rect, dx: number, dy: number): Rect {
  return { left: rect.left + dx, top: rect.top + dy, right: rect.right + dx, bottom: rect.bottom + dy };
}

/** expands (or, for a negative `amount`, shrinks) every edge of `rect` outward by `amount`, keeping it centered */
export function inflateRect(rect: Rect, amount: number): Rect {
  return { left: rect.left - amount, top: rect.top - amount, right: rect.right + amount, bottom: rect.bottom + amount };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** true if any point of `rect` falls within `circle` (a filled disc, not just its outline) */
export function rectIntersectsCircle(rect: Rect, circle: Circle): boolean {
  const closestX = clamp(circle.x, rect.left, rect.right);
  const closestY = clamp(circle.y, rect.top, rect.bottom);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function pointInRect(p: Point, rect: Rect): boolean {
  return p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
}

/** counter-clockwise orientation of the ordered triple (a, b, c): >0 left turn, <0 right turn, 0 collinear */
function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}

/** standard orientation-based segment/segment intersection test, including collinear-overlap cases */
function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);

  if (o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) {
    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
  }

  if (o1 === 0 && onSegment(p1, p2, p3)) return true;
  if (o2 === 0 && onSegment(p1, p2, p4)) return true;
  if (o3 === 0 && onSegment(p3, p4, p1)) return true;
  if (o4 === 0 && onSegment(p3, p4, p2)) return true;
  return false;
}

/** true if `seg` passes through, ends inside, or runs along the boundary of `rect` */
export function rectIntersectsSegment(rect: Rect, seg: Segment): boolean {
  if (pointInRect(seg.a, rect) || pointInRect(seg.b, rect)) return true;

  const corners: Point[] = [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
  for (let i = 0; i < corners.length; i++) {
    const edgeA = corners[i];
    const edgeB = corners[(i + 1) % corners.length];
    if (segmentsIntersect(seg.a, seg.b, edgeA, edgeB)) return true;
  }
  return false;
}

/** true if `a` and `b` overlap by more than a shared edge/corner (touching alone doesn't count, matching `rectIntersectsCircle`'s strict tangency rule) */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** how far past `bounds` (a [0, width] x [0, height] box, e.g. the mascot's host) `rect` extends, summed across all four sides -- 0 when fully contained */
export function rectOverflow(rect: Rect, bounds: { width: number; height: number }): number {
  return (
    Math.max(0, -rect.left) +
    Math.max(0, -rect.top) +
    Math.max(0, rect.right - bounds.width) +
    Math.max(0, rect.bottom - bounds.height)
  );
}
