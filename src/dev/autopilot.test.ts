import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachAutopilot, parseSkipTarget } from "./autopilot";
import { runValueChainScenario } from "../demos/userNeedDependency";
import { CELEBRATE_DURATION_MS } from "../demos/userNeedDependency/phase7";

/**
 * every `attachAutopilot` test drives a real (uncompleted, for most targets) scenario -- with real
 * timers, an earlier test's still-pending animation (e.g. a Phase 20 slide-to-Genesis tween) keeps
 * ticking on the shared JS event loop into the *next* test, racing that test's own settle-polling
 * and producing exactly the kind of order-dependent flakiness this suite hit once one more
 * mutation round-trip (Phase 0's "Let's begin!" gate) was added upstream of every target. Fake
 * timers (same pattern `index.test.ts` already uses) make every test's timing self-contained: each
 * test gets its own fake clock that resets at teardown, so no test's leftover timer can ever fire
 * during another's.
 */
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("parseSkipTarget", () => {
  it("returns the requested target when valid", () => {
    expect(parseSkipTarget("?skipTo=phase10")).toBe("phase10");
    expect(parseSkipTarget("?skipTo=celebrate")).toBe("celebrate");
    expect(parseSkipTarget("?skipTo=phase20")).toBe("phase20");
  });

  it("returns null when the param is missing or unrecognized", () => {
    expect(parseSkipTarget("")).toBeNull();
    expect(parseSkipTarget("?skipTo=bogus")).toBeNull();
    expect(parseSkipTarget("?other=phase10")).toBeNull();
  });
});

/**
 * waits until `mascotHost`'s rendered content stops changing for a few consecutive ticks -- i.e.
 * the autopilot's mutation-observer/click chain has run its course and is now blocked on
 * something it can't produce itself (a real visitor input, or `flushAll`'s `CELEBRATE_DURATION_MS`
 * pause). A fixed tick count was tried first: the chain's length grows with the scenario (more
 * gates before a given target means more microtask/macrotask hops to settle), so a fixed budget is
 * either wastefully large or, once one more gate is added upstream of every target, flaky. Polling
 * for an actually-quiet DOM removes the guess. Each tick advances the fake clock by 0ms (not a real
 * wait) purely to flush the microtask queue between mutation-observer reactions.
 */
async function settle(mascotHost: HTMLElement): Promise<void> {
  const quietTicksNeeded = 10;
  const maxTicks = 200;
  let lastSnapshot: string | null = null;
  let quietTicks = 0;
  for (let i = 0; i < maxTicks && quietTicks < quietTicksNeeded; i++) {
    await vi.advanceTimersByTimeAsync(0);
    const snapshot = mascotHost.innerHTML;
    if (snapshot === lastSnapshot) {
      quietTicks++;
    } else {
      quietTicks = 0;
      lastSnapshot = snapshot;
    }
  }
}

/**
 * settles the autopilot's reaction chain, then waits out Phase 7's post-"Nice to meet you!"
 * `CELEBRATE_DURATION_MS` pause (a real `setTimeout` in source, advanced here via the fake clock)
 * so every target beyond `intro` (which stops before that gate is clicked) can settle into
 * whatever comes after it -- with another settle pass afterward for the mutation-observer
 * reactions (e.g. `celebrate`'s Phase 10 field auto-fills) that only start once that pause elapses.
 */
async function flushAll(mascotHost: HTMLElement): Promise<void> {
  await settle(mascotHost);
  await vi.advanceTimersByTimeAsync(CELEBRATE_DURATION_MS);
  await settle(mascotHost);
}

/**
 * `mascotHost` here is a synthetic wrapper around the two real hosts (`avatarHost`/`dialogHost`),
 * not something passed to the scenario directly -- every assertion/settle-poll below just needs
 * *a* container whose `.querySelector`/`.innerHTML` covers whichever of the two subtrees the
 * mascot's current content actually landed in, and a shared wrapper does that without every
 * call site needing to know or care which host a given render targets.
 */
function buildScenario(target: Parameters<typeof attachAutopilot>[0]["target"], callbacks: Record<string, () => void> = {}) {
  const canvas = document.createElement("div");
  const mascotHost = document.createElement("div");
  const avatarHost = document.createElement("div");
  const dialogHost = document.createElement("div");
  mascotHost.append(avatarHost, dialogHost);
  document.body.append(canvas, mascotHost);

  const autopilot = attachAutopilot({ avatarHost, dialogHost, target });
  runValueChainScenario({
    canvas,
    avatarHost,
    dialogHost,
    onMount: autopilot.onMount,
    onEvolutionStep: autopilot.onEvolutionStep,
    ...callbacks,
  });

  return { canvas, mascotHost };
}

describe("attachAutopilot", () => {
  it("intro: also skips Phase 5's walkthrough, stopping at Phase 7's 'I'm Ben' gate", async () => {
    const onNeedPlaced = vi.fn();
    const { mascotHost } = buildScenario("intro", { onNeedPlaced });
    await flushAll(mascotHost);

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "I'm Ben, by the way. I'm here to help you learn Wardley Mapping!",
    );
    const gateLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Nice to meet you!");
  });

  it("phase10: skips the drag and stops at the first form field, without auto-submitting it", async () => {
    const onNeedPlaced = vi.fn();
    const { canvas, mascotHost } = buildScenario("phase10", { onNeedPlaced });
    await flushAll(mascotHost);

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who should we help today?");
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.textContent).toBe("User");
  });

  it("celebrate: auto-fills all 5 fields and stops right after celebrating, before the second Next link is clicked", async () => {
    const onCelebrate = vi.fn();
    const onEvolutionReady = vi.fn();
    const { canvas, mascotHost } = buildScenario("celebrate", { onCelebrate, onEvolutionReady });
    await flushAll(mascotHost);

    expect(onCelebrate).toHaveBeenCalledOnce();
    expect(onEvolutionReady).not.toHaveBeenCalled();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-next-link")).not.toBeNull();
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).not.toBe("Need");
  });

  it("phase20: also clicks past the second gate, firing onEvolutionReady", async () => {
    const onEvolutionReady = vi.fn();
    const { mascotHost } = buildScenario("phase20", { onEvolutionReady });
    await flushAll(mascotHost);

    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
  });

  it("finale: also auto-confirms every Phase 20 placement, stopping at the placement finale before Phase 25 begins", async () => {
    const { mascotHost } = buildScenario("finale");
    await flushAll(mascotHost);

    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("You made a Wardley Map!");
    const gateLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Next");
  });

  it("thinking: also clicks into Phase 30 and auto-picks the first option at every gate and question, stopping before the finale's own Next link", async () => {
    const { canvas, mascotHost } = buildScenario("thinking");
    await flushAll(mascotHost);

    // "Yes" is always the first `.wd-panel-question-option`, both at each concept's gate and its
    // deep-dive question, so autopilot says Yes to every one of CONCEPT_BANK's 8 concepts and
    // drains the whole bank. "novelty-bias" never gets a candidate node here (its
    // `applicableStages` needs Product/Commodity, and these capabilities never leave their
    // default stage in this flow), leaving 7 gated concepts; of those, "inertia",
    // "efficiency-innovation", "method", and "build-buy-outsource" have an intentionally blank
    // annotation on their first (autopilot-picked, affirmative "we're on track") option, so only
    // 3 of the 7 actually anchor a callout
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(3);
    const finalLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(finalLink).not.toBeNull();
    expect(finalLink!.textContent).toBe("What's next →");
  });

  it("recap: also clicks the final Next link, landing on the closing recap", async () => {
    const onComplete = vi.fn();
    const { mascotHost } = buildScenario("recap", { onComplete });
    await flushAll(mascotHost);

    expect(onComplete).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-panel-recap")).not.toBeNull();
    const cta = mascotHost.querySelector<HTMLAnchorElement>(".wd-panel-recap-cta");
    expect(cta).not.toBeNull();
    expect(cta!.textContent).toBe("Take your next step →");
  });
});
