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

export function animateTo(
  from: Point,
  to: Point,
  durationMs: number,
  onFrame: (point: Point) => void,
  onDone?: () => void,
): void {
  if (durationMs <= 0 || prefersReducedMotion()) {
    onFrame(to);
    onDone?.();
    return;
  }

  const start = performance.now();

  function tick(now: number) {
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
}
