export interface Point {
  x: number;
  y: number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export interface AnimationHandle {
  /** stops the animation before it reaches `to` -- no further `onFrame`/`onDone` calls happen */
  cancel: () => void;
}

export function animateTo(
  from: Point,
  to: Point,
  durationMs: number,
  onFrame: (point: Point) => void,
  onDone?: () => void,
): AnimationHandle {
  if (durationMs <= 0 || prefersReducedMotion()) {
    onFrame(to);
    onDone?.();
    return { cancel: () => {} };
  }

  let cancelled = false;
  const start = performance.now();

  function tick(now: number) {
    if (cancelled) return;
    const elapsed = now - start;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeOutCubic(t);
    onFrame({
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased,
    });
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      onDone?.();
    }
  }

  requestAnimationFrame(tick);
  return {
    cancel: () => {
      cancelled = true;
    },
  };
}
