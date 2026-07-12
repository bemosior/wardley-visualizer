import { describe, expect, it } from "vitest";
import { rectIntersectsCircle, rectIntersectsSegment, rectsIntersect } from "./geometry";
import { DIRECTION_PRIORITY, pickMascotPlacement, type CompassDirection, type MascotObstacles } from "./mascotPlacement";

const AVATAR = { width: 40, height: 60 };
const GAP = 8;
const CLEARANCE = 12;
const NO_OBSTACLES: MascotObstacles = { nodes: [], edges: [], labels: [] };

describe("pickMascotPlacement with no obstacles", () => {
  it("defaults to directly below the anchor, clear of its radius, when nothing else constrains it", () => {
    const placement = pickMascotPlacement({ x: 100, y: 100, radius: 40 }, AVATAR, null, NO_OBSTACLES, null, GAP, CLEARANCE);

    expect(placement.direction).toBe("S");
    // top of the avatar sits radius + clearance below the anchor's center, plus the 1px
    // self-clearance epsilon (see SELF_CLEARANCE_EPSILON) that keeps it strictly clear of its own
    // anchor circle rather than exactly tangent to it
    expect(placement.avatarRect.top).toBe(100 + 40 + 12 + 1);
    expect(placement.avatarRect.left).toBe(100 - AVATAR.width / 2);
    expect(placement.captionRect).toBeNull();
  });

  it("switches to above when below would overflow the host but above fits", () => {
    const bounds = { width: 500, height: 300 };
    const placement = pickMascotPlacement({ x: 250, y: 270, radius: 20 }, AVATAR, null, NO_OBSTACLES, bounds, GAP, CLEARANCE);

    expect(placement.direction).toBe("N");
    expect(placement.avatarRect.bottom).toBe(270 - 20 - 12 - 1);
  });

  it("places the caption beside the avatar, unflipped, when there's room", () => {
    const placement = pickMascotPlacement(
      { x: 100, y: 100, radius: 40 },
      AVATAR,
      { width: 120, height: 32 },
      NO_OBSTACLES,
      { width: 800, height: 800 },
      GAP,
      CLEARANCE,
    );

    expect(placement.flip).toBe(false);
    expect(placement.captionRect).not.toBeNull();
    expect(placement.captionRect!.left).toBe(placement.avatarRect.right + GAP);
  });

  it("flips the caption left when the right side would spill past the host", () => {
    const bounds = { width: 300, height: 300 };
    // anchored near the host's right edge -- a rightward caption would spill past x=300
    const placement = pickMascotPlacement(
      { x: 290, y: 150, radius: 20 },
      AVATAR,
      { width: 150, height: 32 },
      NO_OBSTACLES,
      bounds,
      GAP,
      CLEARANCE,
    );

    expect(placement.flip).toBe(true);
    expect(placement.captionRect!.right).toBe(placement.avatarRect.left - GAP);
  });
});

describe("pickMascotPlacement self-clearance", () => {
  it("never rejects a cardinal direction as colliding with its own anchor node, despite the anchor appearing in the obstacle list at exact tangent distance", () => {
    // regression test: WardleyDemo.getObstacles() includes every registered node, including
    // whichever one the mascot is anchored to. Every cardinal (S/N/E/W) candidate sits, by
    // construction, exactly `radius + clearance` from the anchor's center -- the same distance
    // its own inflated collision circle uses -- so without a strict epsilon, floating-point
    // rounding can flag a candidate as clipping its own anchor node depending on which way it
    // rounds. Reproduces the exact anchor/obstacle values that surfaced this in Phase 20.
    const anchor = { x: 83.5, y: 243.46370192307688, radius: 49.10260336906585 };
    const obstacles: MascotObstacles = {
      nodes: [{ x: anchor.x, y: anchor.y, radius: anchor.radius }],
      edges: [],
      labels: [],
    };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE);

    // with only the anchor's own (self) node to avoid, every cardinal direction is equally
    // obstacle-free -- so the natural tie-break default (directly below) should win, not a
    // distant fallback direction chosen because S/N/E all falsely registered as self-colliding
    expect(placement.direction).toBe("S");
    expect(rectIntersectsCircle(placement.avatarRect, { ...obstacles.nodes[0], radius: obstacles.nodes[0].radius + CLEARANCE })).toBe(
      false,
    );
  });

  it("never lets the avatar overlap a node other than the one it's anchored to", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // sits directly in the default "below" spot
    const obstacles: MascotObstacles = { nodes: [{ x: 100, y: 220, radius: 40 }], edges: [], labels: [] };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE);

    expect(placement.direction).not.toBe("S");
    for (const node of obstacles.nodes) {
      expect(rectIntersectsCircle(placement.avatarRect, { ...node, radius: node.radius + CLEARANCE })).toBe(false);
    }
  });

  it("never lets the caption overlap a node even when the avatar itself is clear", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // sits only where an unflipped (rightward) caption would land, not where the avatar itself sits
    const obstacles: MascotObstacles = { nodes: [{ x: 260, y: 100, radius: 30 }], edges: [], labels: [] };
    const caption = { width: 120, height: 32 };

    const placement = pickMascotPlacement(anchor, AVATAR, caption, obstacles, null, GAP, CLEARANCE);

    expect(placement.direction).toBe("S");
    expect(rectIntersectsCircle(placement.captionRect!, { ...obstacles.nodes[0], radius: obstacles.nodes[0].radius + CLEARANCE })).toBe(
      false,
    );
  });

  it("falls back to the least-bad direction (fewest node overlaps) when every direction is blocked", () => {
    const anchor = { x: 100, y: 100, radius: 10 };
    // a single giant node dead-centered on the anchor overlaps every candidate rect in every direction
    const obstacles: MascotObstacles = { nodes: [{ x: 100, y: 100, radius: 500 }], edges: [], labels: [] };

    expect(() => pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE)).not.toThrow();
  });
});

describe("pickMascotPlacement avoiding evolution-stage labels (hard constraint)", () => {
  it("never lets the avatar overlap a stage label chip", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // sits directly in the default "below" spot
    const obstacles: MascotObstacles = { nodes: [], edges: [], labels: [{ left: 60, top: 150, right: 140, bottom: 180 }] };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE);

    expect(placement.direction).not.toBe("S");
    for (const label of obstacles.labels) {
      expect(rectsIntersect(placement.avatarRect, label)).toBe(false);
    }
  });

  it("never lets the caption overlap a stage label chip even when the avatar itself is clear", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // for the default "below" avatar placement (top 153-213, left 80-120 -- radius 40 + clearance
    // 12 + 1px self-epsilon + half the 60px avatar height), an unflipped caption lands at roughly
    // left 128-248, top 167-199; this label sits right on top of that spot but clear of the avatar
    // itself, so a correct picker flips the caption left instead of overlapping the label
    const obstacles: MascotObstacles = { nodes: [], edges: [], labels: [{ left: 140, top: 170, right: 240, bottom: 200 }] };
    const caption = { width: 120, height: 32 };

    const placement = pickMascotPlacement(anchor, AVATAR, caption, obstacles, null, GAP, CLEARANCE);

    expect(placement.direction).toBe("S");
    expect(rectsIntersect(placement.avatarRect, obstacles.labels[0])).toBe(false);
    expect(rectsIntersect(placement.captionRect!, obstacles.labels[0])).toBe(false);
  });

  it("weighs a label hit the same as a node hit -- prefers crossing an edge over obscuring either", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // "below" crosses an edge but is otherwise open; "above" is edge-free but sits under a label
    // chip. A label must be exactly as hard a constraint as a node, so "below" should still win.
    // Restricted to just these two directions so the comparison isn't muddied by E/W/diagonals,
    // which this obstacle set happens to leave completely free.
    const obstacles: MascotObstacles = {
      nodes: [],
      edges: [{ a: { x: -1000, y: 170 }, b: { x: 1000, y: 170 } }],
      labels: [{ left: 60, top: 20, right: 140, bottom: 45 }],
    };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE, ["N", "S"]);

    expect(placement.direction).toBe("S");
  });
});

describe("pickMascotPlacement avoiding edges (soft constraint)", () => {
  it("prefers a diagonal gap over crossing an edge when every cardinal direction is blocked", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // a horizontal line through the anchor's own y blocks E/W (and every direction whose rect
    // straddles y=100); a vertical line through its own x blocks S/N the same way. Diagonal
    // candidates dodge both, since their offset rects don't straddle either line.
    const obstacles: MascotObstacles = {
      nodes: [],
      edges: [
        { a: { x: -1000, y: 100 }, b: { x: 1000, y: 100 } },
        { a: { x: 100, y: -1000 }, b: { x: 100, y: 1000 } },
      ],
      labels: [],
    };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE);

    expect(["NE", "SE", "SW", "NW"]).toContain(placement.direction);
    for (const edge of obstacles.edges) {
      expect(rectIntersectsSegment(placement.avatarRect, edge)).toBe(false);
    }
  });

  it("still returns a valid, node-clear placement when every direction crosses some edge", () => {
    const anchor = { x: 100, y: 100, radius: 40 };
    // one blocking segment built from the exact same offset math the picker uses, for each of the
    // 8 directions -- guarantees every candidate crosses at least one edge, exercising the
    // "cross an edge as a last resort" fallback rather than a lucky escape hatch.
    const edges = DIRECTION_PRIORITY.map((direction) => blockingSegmentFor(direction, anchor));
    const obstacles: MascotObstacles = { nodes: [], edges, labels: [] };

    const placement = pickMascotPlacement(anchor, AVATAR, null, obstacles, null, GAP, CLEARANCE);

    expect(DIRECTION_PRIORITY).toContain(placement.direction);
    expect(rectIntersectsCircle(placement.avatarRect, { ...anchor, radius: anchor.radius + CLEARANCE })).toBe(false);
  });
});

/** a short segment guaranteed to cross straight through `direction`'s candidate rect, built from the same offset formula `pickMascotPlacement` uses internally */
function blockingSegmentFor(direction: CompassDirection, anchor: { x: number; y: number; radius: number }): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const vectors: Record<CompassDirection, { dx: number; dy: number }> = {
    S: { dx: 0, dy: 1 },
    N: { dx: 0, dy: -1 },
    E: { dx: 1, dy: 0 },
    W: { dx: -1, dy: 0 },
    SE: { dx: 1, dy: 1 },
    SW: { dx: -1, dy: 1 },
    NE: { dx: 1, dy: -1 },
    NW: { dx: -1, dy: -1 },
  };
  const { dx, dy } = vectors[direction];
  const hw = AVATAR.width / 2;
  const hh = AVATAR.height / 2;
  let center: { x: number; y: number };
  if (dx === 0) {
    center = { x: anchor.x, y: anchor.y + dy * (anchor.radius + CLEARANCE + hh) };
  } else if (dy === 0) {
    center = { x: anchor.x + dx * (anchor.radius + CLEARANCE + hw), y: anchor.y };
  } else {
    const dist = anchor.radius + CLEARANCE + Math.max(hw, hh);
    center = { x: anchor.x + dx * dist, y: anchor.y + dy * dist };
  }
  return { a: { x: center.x - 100, y: center.y }, b: { x: center.x + 100, y: center.y } };
}
