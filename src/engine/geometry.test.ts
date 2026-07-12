import { describe, expect, it } from "vitest";
import {
  horizontalOverflow,
  inflateRect,
  rectFromCenter,
  rectIntersectsCircle,
  rectIntersectsSegment,
  rectOverflow,
  rectsIntersect,
  shiftRect,
} from "./geometry";

describe("rectFromCenter / shiftRect / inflateRect", () => {
  it("builds a rect centered on the given point", () => {
    const rect = rectFromCenter({ x: 10, y: 20 }, 40, 60);
    expect(rect).toEqual({ left: -10, top: -10, right: 30, bottom: 50 });
  });

  it("translates every edge by dx/dy", () => {
    const rect = rectFromCenter({ x: 0, y: 0 }, 10, 10);
    expect(shiftRect(rect, 5, -5)).toEqual({ left: 0, top: -10, right: 10, bottom: 0 });
  });

  it("expands every edge outward by the given amount", () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(inflateRect(rect, 5)).toEqual({ left: -5, top: -5, right: 15, bottom: 15 });
  });
});

describe("rectsIntersect", () => {
  it("is true when two rects overlap", () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 5, right: 15, bottom: 15 })).toBe(true);
  });

  it("is false when two rects sit clear of each other", () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 20, top: 20, right: 30, bottom: 30 })).toBe(false);
  });

  it("is false for two rects merely sharing an edge (touching, not overlapping)", () => {
    expect(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
  });
});

describe("rectIntersectsCircle", () => {
  it("is true when the circle's center is inside the rect", () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectIntersectsCircle(rect, { x: 5, y: 5, radius: 1 })).toBe(true);
  });

  it("is true when the circle overlaps a rect edge without the center being inside", () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectIntersectsCircle(rect, { x: 15, y: 5, radius: 6 })).toBe(true);
  });

  it("is false when the circle sits clear of the rect", () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectIntersectsCircle(rect, { x: 15, y: 5, radius: 4 })).toBe(false);
  });

  it("is false for a circle merely tangent to the rect (touching, not overlapping)", () => {
    const rect = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(rectIntersectsCircle(rect, { x: 15, y: 5, radius: 5 })).toBe(false);
  });
});

describe("rectIntersectsSegment", () => {
  const rect = { left: 0, top: 0, right: 10, bottom: 10 };

  it("is true when a segment endpoint lands inside the rect", () => {
    expect(rectIntersectsSegment(rect, { a: { x: 5, y: 5 }, b: { x: 100, y: 100 } })).toBe(true);
  });

  it("is true when a segment passes straight through the rect", () => {
    expect(rectIntersectsSegment(rect, { a: { x: -5, y: 5 }, b: { x: 15, y: 5 } })).toBe(true);
  });

  it("is false when a segment passes well clear of the rect", () => {
    expect(rectIntersectsSegment(rect, { a: { x: 20, y: 0 }, b: { x: 20, y: 10 } })).toBe(false);
  });

  it("is true for a segment running along one of the rect's own edges (collinear overlap)", () => {
    expect(rectIntersectsSegment(rect, { a: { x: -5, y: 0 }, b: { x: 15, y: 0 } })).toBe(true);
  });
});

describe("rectOverflow", () => {
  it("is zero when the rect fits entirely within bounds", () => {
    const rect = { left: 5, top: 5, right: 15, bottom: 15 };
    expect(rectOverflow(rect, { width: 100, height: 100 })).toBe(0);
  });

  it("sums how far the rect spills past every side it crosses", () => {
    const rect = { left: -3, top: -2, right: 108, bottom: 50 };
    expect(rectOverflow(rect, { width: 100, height: 40 })).toBe(3 + 2 + 8 + 10);
  });
});

describe("horizontalOverflow", () => {
  it("is zero when the rect fits entirely within bounds horizontally, even if it overflows vertically", () => {
    const rect = { left: 5, top: -50, right: 15, bottom: 500 };
    expect(horizontalOverflow(rect, { width: 100, height: 100 })).toBe(0);
  });

  it("sums how far the rect spills past the left and right edges, ignoring top/bottom", () => {
    const rect = { left: -3, top: -2, right: 108, bottom: 500 };
    expect(horizontalOverflow(rect, { width: 100, height: 40 })).toBe(3 + 8);
  });
});
