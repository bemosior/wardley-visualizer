import { describe, expect, it, vi, afterEach } from "vitest";
import { animateTo } from "./animate";

/** a controllable requestAnimationFrame stand-in -- lets a test advance one frame at a time and
 * assert on exactly what ran, instead of racing the real browser's frame timing. */
function mockRaf(): { flush: (time: number) => void } {
  const callbacks: FrameRequestCallback[] = [];
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    callbacks.push(cb);
    return callbacks.length;
  }) as typeof requestAnimationFrame;
  return {
    flush(time: number) {
      const pending = callbacks.splice(0, callbacks.length);
      pending.forEach((cb) => cb(time));
    },
  };
}

describe("animateTo", () => {
  const originalMatchMedia = window.matchMedia;
  const originalRaf = window.requestAnimationFrame;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRaf;
    vi.restoreAllMocks();
  });

  it("stops calling onFrame/onDone once cancelled mid-flight, even if a frame was already queued", () => {
    // src/test/setup.ts shims matchMedia to always report reduced motion, which makes animateTo
    // take its instant synchronous path -- disable that here to exercise the real rAF-driven path.
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    const raf = mockRaf();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    vi.spyOn(performance, "now").mockReturnValue(0);

    const handle = animateTo({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, onFrame, onDone);

    vi.spyOn(performance, "now").mockReturnValue(50);
    raf.flush(50);
    expect(onFrame).toHaveBeenCalledTimes(1);

    // cancel while a second frame is already queued (the tick above re-scheduled itself via
    // requestAnimationFrame since t < 1) -- this is exactly what `slideToGenesis`'s cancellation
    // needs: a visitor grabbing the node mid-slide must stop it from clobbering their drag on the
    // very next frame, not just from scheduling any *new* ones.
    handle.cancel();
    vi.spyOn(performance, "now").mockReturnValue(100);
    raf.flush(100);

    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("still returns a harmless cancel() on the instant (reduced-motion) path", () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const onFrame = vi.fn();
    const onDone = vi.fn();

    const handle = animateTo({ x: 0, y: 0 }, { x: 100, y: 0 }, 100, onFrame, onDone);

    expect(onFrame).toHaveBeenCalledWith({ x: 100, y: 0 });
    expect(onDone).toHaveBeenCalledOnce();
    expect(() => handle.cancel()).not.toThrow();
  });
});
