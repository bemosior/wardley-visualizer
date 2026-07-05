import { describe, expect, it, vi } from "vitest";
import { attachAutopilot, parseSkipTarget } from "./autopilot";
import { runValueChainScenario } from "../demos/userNeedDependency";

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

/** flushes both pending promise microtasks and queued MutationObserver callbacks */
async function flushAll(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function buildScenario(target: Parameters<typeof attachAutopilot>[0]["target"], callbacks: Record<string, () => void> = {}) {
  const canvas = document.createElement("div");
  const mascotHost = document.createElement("div");
  document.body.append(canvas, mascotHost);

  const autopilot = attachAutopilot({ mascotHost, target });
  runValueChainScenario({
    canvas,
    mascotHost,
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
    await flushAll();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("I'm Ben, by the way.");
    const gateLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Nice to meet you!");
  });

  it("phase10: skips the drag and stops at the first form field, without auto-submitting it", async () => {
    const onNeedPlaced = vi.fn();
    const { canvas, mascotHost } = buildScenario("phase10", { onNeedPlaced });
    await flushAll();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who should we help today?");
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.textContent).toBe("User");
  });

  it("celebrate: auto-fills all 5 fields and stops right after celebrating, before the second Next link is clicked", async () => {
    const onCelebrate = vi.fn();
    const onEvolutionReady = vi.fn();
    const { canvas, mascotHost } = buildScenario("celebrate", { onCelebrate, onEvolutionReady });
    await flushAll();

    expect(onCelebrate).toHaveBeenCalledOnce();
    expect(onEvolutionReady).not.toHaveBeenCalled();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-next-link")).not.toBeNull();
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).not.toBe("Need");
  });

  it("phase20: also clicks past the second gate, firing onEvolutionReady", async () => {
    const onEvolutionReady = vi.fn();
    const { mascotHost } = buildScenario("phase20", { onEvolutionReady });
    await flushAll();

    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
  });

  it("finale: also auto-confirms every Phase 20 placement, stopping at the placement finale before Phase 25 begins", async () => {
    const { mascotHost } = buildScenario("finale");
    await flushAll();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("You made a Wardley Map!");
    const gateLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Next");
  });

  it("thinking: also clicks into Phase 30 and auto-picks the first option at every gate and question, stopping before the finale's own Next link", async () => {
    const { canvas, mascotHost } = buildScenario("thinking");
    await flushAll();

    // "Yes" is always the first `.wd-panel-question-option`, both at each concept's gate and its
    // deep-dive question, so autopilot says Yes to every one of CONCEPT_BANK's 7 concepts and
    // drains the whole bank, landing one annotation per concept rather than stopping early
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(7);
    const finalLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(finalLink).not.toBeNull();
    expect(finalLink!.textContent).toBe("What's next →");
  });

  it("recap: also clicks the final Next link, landing on the closing recap", async () => {
    const onComplete = vi.fn();
    const { mascotHost } = buildScenario("recap", { onComplete });
    await flushAll();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-panel-recap")).not.toBeNull();
    const cta = mascotHost.querySelector<HTMLAnchorElement>(".wd-panel-recap-cta");
    expect(cta).not.toBeNull();
    expect(cta!.textContent).toBe("Take your next step →");
  });
});
