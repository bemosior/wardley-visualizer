import { describe, expect, it, vi } from "vitest";
import { attachAutopilot, parseSkipTarget } from "./autopilot";
import { runValueChainScenario } from "../demos/userNeedDependency";

describe("parseSkipTarget", () => {
  it("returns the requested target when valid", () => {
    expect(parseSkipTarget("?skipTo=phase1")).toBe("phase1");
    expect(parseSkipTarget("?skipTo=celebrate")).toBe("celebrate");
    expect(parseSkipTarget("?skipTo=phase2")).toBe("phase2");
  });

  it("returns null when the param is missing or unrecognized", () => {
    expect(parseSkipTarget("")).toBeNull();
    expect(parseSkipTarget("?skipTo=bogus")).toBeNull();
    expect(parseSkipTarget("?other=phase1")).toBeNull();
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
  it("phase1: skips the drag and stops at the first form field, without auto-submitting it", async () => {
    const onNeedPlaced = vi.fn();
    const { canvas, mascotHost } = buildScenario("phase1", { onNeedPlaced });
    await flushAll();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("What does the user need?");
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).toBe("Need");
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

  it("phase2: also clicks past the second gate, firing onEvolutionReady", async () => {
    const onEvolutionReady = vi.fn();
    const { mascotHost } = buildScenario("phase2", { onEvolutionReady });
    await flushAll();

    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
  });

  it("finale: also auto-confirms every Phase 2 placement, stopping at the placement finale before Phase 3 begins", async () => {
    const { mascotHost } = buildScenario("finale");
    await flushAll();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Wardley Map");
    const gateLink = mascotHost.querySelector<HTMLAnchorElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Let's think about it →");
  });

  it("thinking: also clicks into Phase 3 and auto-picks an option for every question, stopping before the finale's own Next link", async () => {
    const { canvas, mascotHost } = buildScenario("thinking");
    await flushAll();

    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(3);
    const finalLink = mascotHost.querySelector<HTMLAnchorElement>(".wd-next-link");
    expect(finalLink).not.toBeNull();
    expect(finalLink!.textContent).toBe("What's next →");
  });
});
