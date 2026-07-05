import { describe, expect, it, vi } from "vitest";
import { runValueChainScenario } from "./index";
import { MAP_CAPTION_FADE_MS } from "../../engine/WardleyDemo";
import { NEED_CATALOG } from "../../domain/needCatalog";
import { BIAS_CHECK_QUESTION, BUILD_BUY_OUTSOURCE_QUESTION, QUESTION_POOL } from "../../domain/questionBank";

function drag(handle: Element, to: { x: number; y: number }): void {
  handle.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 }));
}

/** happy-dom doesn't implement HTMLFormElement.requestSubmit; dispatch the event it relies on directly */
function submitForm(mascotHost: HTMLElement): void {
  mascotHost.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
}

function submitText(mascotHost: HTMLElement, value: string): void {
  const input = mascotHost.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
  input.value = value;
  submitForm(mascotHost);
}

/** every gate/confirm link (every "Next" click point in the scenario) renders inside the mascot's own speech bubble */
function clickNext(mascotHost: HTMLElement): void {
  mascotHost.querySelector<HTMLButtonElement>(".wd-next-link")!.click();
}

function buildScenario(onCelebrate: () => void) {
  const canvas = document.createElement("div");
  const mascotHost = document.createElement("div");
  document.body.append(canvas, mascotHost);
  runValueChainScenario({ canvas, mascotHost, onCelebrate });
  return { canvas, mascotHost };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** drags the Need into place (default layout's target is centerX=200, needY=76 for the default 400x300 viewBox), then clicks past Phase 5's five "Next" gates ("Need placed", the User/Need/Capability walkthrough, and the Part A/B/C explanation) and Phase 7's single "I'm Ben" introduction gate into the form */
async function completeDragStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
  const needNode = canvas.querySelector('[data-node-id="need"]')!;
  drag(needNode, { x: 200, y: 76 });
  await flush();
  for (let i = 0; i < 6; i++) {
    clickNext(mascotHost);
    await flush();
  }
}

describe("runValueChainScenario", () => {
  it("renders the Need already on the canvas, out of place and beckoning, before any form step", () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    expect(needNode.classList.contains("wd-node--beckon")).toBe(true);
    expect(needNode.getAttribute("transform")).not.toBe("translate(200, 76)");
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Solve the puzzle.");
    expect(mascotHost.querySelector("form")).toBeNull();
  });

  it("fires onNeedPlaced as soon as the Need snaps, and waits for a Next click before advancing", async () => {
    const onNeedPlaced = vi.fn();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost, onNeedPlaced });

    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 200, y: 76 });
    await flush();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-next-link")).not.toBeNull();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("You made a Value Chain!");
  });

  it("walks the user through User/Need/Capability, relabels the three Capability nodes to Part A/B/C, explains multi-part needs, then has the mascot introduce itself before the form", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 200, y: 76 });
    await flush();
    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("This is a User.");

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("This is a User Need.");

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("This is a Capability.");

    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(
      "A Value Chain is like a recipe.",
    );
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("Part A");
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Part B");
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Part C");

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("I'm Ben, by the way.");
    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "I'm here to help you learn Wardley Mapping!",
    );

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector("form")).not.toBeNull();
    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who should we help today?");
  });

  it("does not advance to the form sequence if the Need is dropped away from its target", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 0, y: 0 });
    await flush();

    expect(needNode.classList.contains("wd-node--charged")).toBe(false);
    expect(mascotHost.querySelector("form")).toBeNull();
  });

  it("walks user -> need -> 3 capabilities after the drag step, relabeling each node as it's answered", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    await completeDragStep(canvas, mascotHost);

    submitText(mascotHost, "A commuter");
    await flush();
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.textContent).toBe("A commuter");

    const need = NEED_CATALOG[0];
    submitText(mascotHost, need.label);
    await flush();
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).toBe(need.label);

    submitText(mascotHost, "A kettle");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("A kettle");

    submitText(mascotHost, "Water");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Water");

    submitText(mascotHost, "Electricity");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Electricity");
  });

  it("shows placeholders matching the selected need, not a different need's example", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    await completeDragStep(canvas, mascotHost);

    submitText(mascotHost, "A home cook");
    await flush();

    const grocery = NEED_CATALOG.find((need) => need.id === "fresh-grocery-delivery")!;
    submitText(mascotHost, grocery.label);
    await flush();

    for (const placeholder of grocery.capabilityPlaceholders) {
      expect(mascotHost.querySelector<HTMLInputElement>(".wd-panel-form-input")!.placeholder).toBe(placeholder);
      submitText(mascotHost, "answer");
      await flush();
    }
  });

  it("shows an 'All done!' placeholder and fires onCelebrate once the last capability is answered", async () => {
    const onCelebrate = vi.fn();
    const { canvas, mascotHost } = buildScenario(onCelebrate);
    await completeDragStep(canvas, mascotHost);
    expect(onCelebrate).not.toHaveBeenCalled();

    submitText(mascotHost, "A commuter");
    await flush();
    submitText(mascotHost, NEED_CATALOG[0].label);
    await flush();
    submitText(mascotHost, "A kettle");
    await flush();
    submitText(mascotHost, "Water");
    await flush();
    expect(onCelebrate).not.toHaveBeenCalled();

    submitText(mascotHost, "Electricity");
    await flush();

    expect(mascotHost.querySelector(".wd-panel-content")).not.toBeNull();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("All done!");
    expect(onCelebrate).toHaveBeenCalledOnce();
  });

  it("shows a second Next link after celebrating, reveals the map backdrop only once it's clicked, and fires onEvolutionReady", async () => {
    const onEvolutionReady = vi.fn();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost, onEvolutionReady });
    await completeDragStep(canvas, mascotHost);

    submitText(mascotHost, "A commuter");
    await flush();
    submitText(mascotHost, NEED_CATALOG[0].label);
    await flush();
    submitText(mascotHost, "A kettle");
    await flush();
    submitText(mascotHost, "Water");
    await flush();
    submitText(mascotHost, "Electricity");
    await flush();

    expect(mascotHost.querySelector(".wd-next-link")).not.toBeNull();
    expect(onEvolutionReady).not.toHaveBeenCalled();
    expect(canvas.querySelector(".wd-backdrop")).toBeNull();

    vi.useFakeTimers();
    clickNext(mascotHost);
    await flush();

    expect(canvas.querySelector(".wd-backdrop")).not.toBeNull();

    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();

    expect(canvas.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(canvas.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(canvas.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--beckon")).toBe(true);

    // the slide to Genesis is staggered behind the mascot bubble's own fade-in delay
    // (MAP_CAPTION_FADE_MS), not immediate
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).not.toMatch(/^translate\(50,/);
    vi.advanceTimersByTime(MAP_CAPTION_FADE_MS);
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toMatch(/^translate\(50,/);
    vi.useRealTimers();
  });

  it("mounts the mascot immediately, before any drag/form step, then swaps in a Need-label/Genesis bubble once Phase 20 begins", async () => {
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost });

    expect(mascotHost.querySelector(".wd-mascot")).not.toBeNull();

    await completeDragStep(canvas, mascotHost);

    const need = NEED_CATALOG[0];
    submitText(mascotHost, "A commuter");
    await flush();
    submitText(mascotHost, need.label);
    await flush();
    submitText(mascotHost, "A kettle");
    await flush();
    submitText(mascotHost, "Water");
    await flush();
    submitText(mascotHost, "Electricity");
    await flush();

    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(
      `Is ${need.label} in Genesis?`,
    );
  });

  /** walks the Phase 10 form and clicks past the Phase 10->20 gate, landing right where the Need starts beckoning on the map (default layout's Genesis x is 50, at the Need's unchanged y of 76) */
  async function reachEvolutionStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
    await completeDragStep(canvas, mascotHost);
    submitText(mascotHost, "A commuter");
    await flush();
    submitText(mascotHost, NEED_CATALOG[0].label);
    await flush();
    submitText(mascotHost, "A kettle");
    await flush();
    submitText(mascotHost, "Water");
    await flush();
    submitText(mascotHost, "Electricity");
    await flush();
    clickNext(mascotHost);
    await flush();
    vi.advanceTimersByTime(MAP_CAPTION_FADE_MS);
  }

  it("doesn't show a confirm link until the Need is dragged at least once", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost });
    await reachEvolutionStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 150, y: 76 });
    await flush();

    const confirmLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(confirmLink).not.toBeNull();
    expect(confirmLink!.textContent).toBe("Confirm placement");
    vi.useRealTimers();
  });

  it("updates the mascot bubble's subheading live as the Need is dragged, and moves on to Capability-1 once the confirm link is clicked", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, mascotHost }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(
      `Is ${NEED_CATALOG[0].label} in Genesis?`,
    );

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 250, y: 76 });
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(
      `Is ${NEED_CATALOG[0].label} in Product?`,
    );
    expect(resolved).toBe(false);

    clickNext(mascotHost);
    await flush();

    // the scenario doesn't resolve yet — Capability-1/2/3 still have to go through
    // the same drag-confirm pattern before the whole thing is done
    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is A kettle in Genesis?");
    vi.useRealTimers();
  });

  /** drags a node to (x, y) and clicks the resulting "Confirm placement" link — the same pattern used for the Need and each capability's evolution step */
  async function confirmEvolutionStep(
    canvas: HTMLElement,
    mascotHost: HTMLElement,
    nodeId: string,
    x: number,
    y: number,
  ): Promise<void> {
    drag(canvas.querySelector(`[data-node-id="${nodeId}"]`)!, { x, y });
    await flush();
    clickNext(mascotHost);
    await flush();
  }

  it("slides each capability into the Genesis column and walks Capability-1/2/3 through the same drag-confirm pattern, celebrating once all four are placed", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, mascotHost }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(canvas, mascotHost);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is A kettle in Genesis?");
    expect(canvas.querySelector('[data-node-id="dependency-1"]')!.getAttribute("transform")).toMatch(
      /^translate\(50,/,
    );

    await confirmEvolutionStep(canvas, mascotHost, "dependency-1", 150, 157);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is Water in Genesis?");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, mascotHost, "dependency-2", 150, 157);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is Electricity in Genesis?");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, mascotHost, "dependency-3", 150, 157);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("You made a Wardley Map!");
    expect(resolved).toBe(false);

    // the placement finale's confirm link starts Phase 30's Q&A rather than resolving the scenario
    clickNext(mascotHost);
    await flush();

    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(BIAS_CHECK_QUESTION.prompt);
    vi.useRealTimers();
  });

  /** walks placement through the Phase 20->30 gate, landing on Capability 1's bias-check question */
  async function reachThinkingStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
    await reachEvolutionStep(canvas, mascotHost);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-1", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-2", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-3", 150, 157);
    clickNext(mascotHost);
    await flush();
  }

  function clickOption(mascotHost: HTMLElement, index = 0): void {
    mascotHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option")[index].click();
  }

  it("asks the bias-check question for Capability 1, the build/buy/outsource question for Capability 2, and a pool question for Capability 3", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost });
    await reachThinkingStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("A kettle");
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(BIAS_CHECK_QUESTION.prompt);

    clickOption(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Water");
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(BUILD_BUY_OUTSOURCE_QUESTION.prompt);

    clickOption(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Electricity");
    const poolPrompts = QUESTION_POOL.map((q) => q.prompt);
    expect(poolPrompts).toContain(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent);
    vi.useRealTimers();
  });

  it("rerolls to a different question for Capability 3 without advancing, then commits on an option click", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, mascotHost });
    await reachThinkingStep(canvas, mascotHost);

    clickOption(mascotHost);
    await flush();
    clickOption(mascotHost);
    await flush();

    const firstPrompt = mascotHost.querySelector(".wd-panel-question-prompt")!.textContent;
    const reroll = mascotHost.querySelector<HTMLAnchorElement>(".wd-panel-question-reroll")!;
    expect(reroll).not.toBeNull();
    reroll.click();
    await flush();

    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).not.toBe(firstPrompt);
    // still Capability 3's question — rerolling doesn't advance to the finale
    expect(mascotHost.querySelector(".wd-panel-question-prompt")).not.toBeNull();

    clickOption(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-question-prompt")).toBeNull();
    vi.useRealTimers();
  });

  it("anchors a callout to each capability's node as its question is answered, then celebrates and resolves on the final Next click", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const mascotHost = document.createElement("div");
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, mascotHost }).then(() => {
      resolved = true;
    });
    await reachThinkingStep(canvas, mascotHost);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(1);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(2);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(3);

    const finalLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link")!;
    expect(finalLink.textContent).toBe("What's next →");
    finalLink.click();
    await flush();

    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it("does not advance on a whitespace-only capability answer", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    await completeDragStep(canvas, mascotHost);
    submitText(mascotHost, "A commuter");
    await flush();
    submitText(mascotHost, NEED_CATALOG[0].label);
    await flush();

    submitText(mascotHost, "   ");
    await flush();

    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe(
      "What's something they depend on to get this need met? \r\n(1 of 3)",
    );
  });
});
