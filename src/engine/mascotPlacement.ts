import type { Point } from "./animate";
import {
  horizontalOverflow,
  inflateRect,
  rectFromCenter,
  rectIntersectsCircle,
  rectIntersectsSegment,
  rectOverflow,
  rectsIntersect,
  type Rect,
} from "./geometry";

export type CompassDirection = "S" | "N" | "E" | "W" | "SE" | "SW" | "NE" | "NW";

/**
 * search order when candidates are otherwise tied on obstacle-avoidance and overflow: below the
 * node reads most naturally, then above, then beside it, then (as a last resort) tucked into a
 * diagonal gap between two edges.
 */
export const DIRECTION_PRIORITY: CompassDirection[] = ["S", "N", "E", "W", "SE", "SW", "NE", "NW"];

/**
 * `DIRECTION_PRIORITY` minus the two directions that share the anchor's exact y (E/W) -- for a
 * caller (Phase 20's evolution-axis drag) whose anchor node is about to slide freely along a fixed
 * horizontal row across the *entire* map width. `pickMascotPlacement` only ever sees a snapshot of
 * the scene, so it can't know a node is about to travel through the very spot it just chose beside
 * that node -- E/W candidates sit at the anchor's own y, so a long horizontal drag runs the avatar
 * over every time. The four diagonals stay in the set: their vertical offset (see
 * `avatarRectForDirection`'s diagonal branch) already clears the anchor's row by the same margin S/N
 * do, so they're just as safe as a fallback when both S and N cross an edge.
 */
export const NON_ROW_DIRECTIONS: CompassDirection[] = DIRECTION_PRIORITY.filter((d) => d !== "E" && d !== "W");

const DIRECTION_VECTORS: Record<CompassDirection, { dx: number; dy: number }> = {
  S: { dx: 0, dy: 1 },
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  W: { dx: -1, dy: 0 },
  SE: { dx: 1, dy: 1 },
  SW: { dx: -1, dy: 1 },
  NE: { dx: 1, dy: -1 },
  NW: { dx: -1, dy: -1 },
};

/**
 * dominates every lower tier -- a candidate that violates any "never" rule (clips a node or label,
 * plants the avatar off the map, or spills more than `CAPTION_OFF_MAP_BUDGET` of the caption's
 * width off the map) is worse than a candidate that clips any number of edges or spills less.
 */
const HARD_CONSTRAINT_WEIGHT = 1_000_000;
/** dominates overflow/tie-break, but never a hard-constraint hit -- edges are a soft "avoid if possible" constraint */
const EDGE_HIT_WEIGHT = 10_000;
/** spaces `DIRECTION_PRIORITY` entries far enough apart to break ties deterministically without ever outweighing a real overflow-px difference */
const TIE_BREAK_STEP = 0.01;

/** the most the caption may spill past the map's left/right edges, as a fraction of its own width -- past this it's scored as a hard-constraint violation, same as clipping a node */
const CAPTION_OFF_MAP_BUDGET = 0.25;

/**
 * a candidate's offset from the anchor is, by construction, exactly `clearance` past the anchor's
 * own (inflated, by that same `clearance`) circle -- an exact tangency that floating-point
 * rounding can push to either side of `rectIntersectsCircle`'s strict `<`, spuriously flagging a
 * node as colliding with *itself*. A tiny extra nudge, invisible on screen, keeps every candidate
 * strictly clear of its own anchor regardless of rounding direction.
 */
const SELF_CLEARANCE_EPSILON = 1;

export interface BoxSize {
  width: number;
  height: number;
}

export interface MascotObstacles {
  nodes: (Point & { radius: number })[];
  edges: { a: Point; b: Point }[];
  /** evolution-stage label chips (e.g. "Genesis"/"Custom-Built"/"Product"/"Commodity") -- a hard constraint, same tier as `nodes`, not the soft "avoid if possible" tier `edges` gets */
  labels: Rect[];
}

export interface MascotPlacement {
  direction: CompassDirection;
  flip: boolean;
  avatarRect: Rect;
  captionRect: Rect | null;
}

function avatarRectForDirection(
  direction: CompassDirection,
  anchor: Point & { radius: number },
  size: BoxSize,
  clearance: number,
): Rect {
  const { dx, dy } = DIRECTION_VECTORS[direction];
  const hw = size.width / 2;
  const hh = size.height / 2;
  const reach = clearance + SELF_CLEARANCE_EPSILON;
  let center: Point;
  if (dx === 0) {
    center = { x: anchor.x, y: anchor.y + dy * (anchor.radius + reach + hh) };
  } else if (dy === 0) {
    center = { x: anchor.x + dx * (anchor.radius + reach + hw), y: anchor.y };
  } else {
    // a diagonal offset large enough that the rect's near corner still clears the anchor's circle
    const dist = anchor.radius + reach + Math.max(hw, hh);
    center = { x: anchor.x + dx * dist, y: anchor.y + dy * dist };
  }
  return rectFromCenter(center, size.width, size.height);
}

function captionRectFor(avatarRect: Rect, size: BoxSize, flip: boolean, gap: number): Rect {
  const centerY = (avatarRect.top + avatarRect.bottom) / 2;
  const left = flip ? avatarRect.left - gap - size.width : avatarRect.right + gap;
  return { left, top: centerY - size.height / 2, right: left + size.width, bottom: centerY + size.height / 2 };
}

/** node radii get this much extra buffer beyond bare non-overlap -- a visible gap reads far more clearly as "not touching" than a mathematically-clear-by-one-pixel edge */
function inflate(node: Point & { radius: number }, clearance: number): Point & { radius: number } {
  return { x: node.x, y: node.y, radius: node.radius + clearance };
}

/**
 * chooses where to plant the mascot's avatar (and, if `captionSize` is given, its beside-the-avatar
 * caption) relative to `anchor` -- a node's center plus its on-screen radius, already inflated by
 * `clearance` worth of breathing room by the caller if desired (the anchor's own radius is used
 * as-is here; `clearance` only pads *other* obstacles).
 *
 * Every one of the 8 compass directions around the anchor, crossed with both caption sides (when
 * there's a caption), is scored and the minimum wins:
 *   1. never let the avatar or caption overlap a node (including nodes other than the anchor) or
 *      an evolution-stage label chip; never let the avatar land outside `bounds` (the map) at all;
 *      never let more than `CAPTION_OFF_MAP_BUDGET` of the caption's own width spill past the map's
 *      left/right edges -- all four are the dominant term, so any candidate that breaks one of them
 *      loses to any candidate that doesn't, no matter what else is true about it. Skipped when
 *      `bounds` is `null` (the host has no real layout yet -- e.g. unit tests, or a reposition that
 *      races page load), since there's no meaningful "the map" to measure against yet.
 *   2. avoid crossing an edge, but cross one rather than break a rule from (1) if every direction does.
 *   3. among candidates that already satisfy (1), prefer less total spill past `bounds` anyway (0 for
 *      every avatar candidate once (1) is enforced, but still meaningful for the caption's remaining,
 *      in-budget spill, and it's what lets a hopeless scene -- nothing satisfies (1) -- degrade
 *      gracefully to the least-bad candidate instead of an arbitrary one).
 *   4. break remaining ties by `DIRECTION_PRIORITY`'s order, so the result is deterministic and
 *      favors the most naturally-read placement (below, then above, then beside) when several
 *      directions are otherwise equivalent.
 *
 * Pure and DOM-free so the search itself is unit-testable without mocking `getBoundingClientRect`.
 *
 * `directions` narrows the 8-direction search (default `DIRECTION_PRIORITY`) -- see
 * `NON_ROW_DIRECTIONS` for the one caller that restricts it today.
 */
export function pickMascotPlacement(
  anchor: Point & { radius: number },
  avatarSize: BoxSize,
  captionSize: BoxSize | null,
  obstacles: MascotObstacles,
  bounds: BoxSize | null,
  gap: number,
  clearance: number,
  directions: CompassDirection[] = DIRECTION_PRIORITY,
): MascotPlacement {
  const inflatedNodes = obstacles.nodes.map((n) => inflate(n, clearance));
  const inflatedLabels = obstacles.labels.map((r) => inflateRect(r, clearance));
  const flips = captionSize ? [false, true] : [false];

  let best: MascotPlacement | null = null;
  let bestScore = Infinity;

  directions.forEach((direction, dirIndex) => {
    const avatarRect = avatarRectForDirection(direction, anchor, avatarSize, clearance);
    flips.forEach((flip, flipIndex) => {
      const captionRect = captionSize ? captionRectFor(avatarRect, captionSize, flip, gap) : null;

      const nodeHits = inflatedNodes.filter(
        (n) => rectIntersectsCircle(avatarRect, n) || (captionRect !== null && rectIntersectsCircle(captionRect, n)),
      ).length;
      const labelHits = inflatedLabels.filter(
        (r) => rectsIntersect(avatarRect, r) || (captionRect !== null && rectsIntersect(captionRect, r)),
      ).length;
      const edgeHits = obstacles.edges.filter(
        (e) => rectIntersectsSegment(avatarRect, e) || (captionRect !== null && rectIntersectsSegment(captionRect, e)),
      ).length;
      // the avatar must never be off the map at all; the caption may spill, but never more than
      // CAPTION_OFF_MAP_BUDGET of its own width -- both `false` (never violated) when `bounds`
      // isn't measurable yet, same as every other bounds-dependent check here.
      const avatarOffMap = bounds !== null && rectOverflow(avatarRect, bounds) > 0;
      const captionOverBudget =
        bounds !== null &&
        captionRect !== null &&
        horizontalOverflow(captionRect, bounds) / (captionRect.right - captionRect.left) > CAPTION_OFF_MAP_BUDGET;
      const hardHits = nodeHits + labelHits + (avatarOffMap ? 1 : 0) + (captionOverBudget ? 1 : 0);
      const overflow = bounds
        ? rectOverflow(avatarRect, bounds) + (captionRect !== null ? rectOverflow(captionRect, bounds) : 0)
        : 0;
      const tieBreak = (dirIndex * flips.length + flipIndex) * TIE_BREAK_STEP;

      const score = hardHits * HARD_CONSTRAINT_WEIGHT + edgeHits * EDGE_HIT_WEIGHT + overflow + tieBreak;
      if (score < bestScore) {
        bestScore = score;
        best = { direction, flip, avatarRect, captionRect };
      }
    });
  });

  // every caller passes a non-empty `directions` array, so the loop above always assigns `best` at least once.
  return best!;
}
