import { describe, expect, it, vi } from "vitest";
import { runValueChainScenario } from "./userNeedDependency";
import { MAP_CAPTION_FADE_MS } from "../engine/WardleyDemo";
import { NEED_CATALOG } from "../domain/needCatalog";
import { BIAS_CHECK_QUESTION, BUILD_BUY_OUTSOURCE_QUESTION, QUESTION_POOL } from "../domain/questionBank";

function drag(handle: Element, to: { x: number; y: number }): void {
  handle.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 }));
}

/** happy-dom doesn't implement HTMLFormElement.requestSubmit; dispatch the event it relies on directly */
function submitForm(toolbox: HTMLElement): void {
  toolbox.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
}

function submitText(toolbox: HTMLElement, value: string): void {
  const input = toolbox.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
  input.value = value;
  submitForm(toolbox);
}

function submitSelect(toolbox: HTMLElement, value: string): void {
  const select = toolbox.querySelector<HTMLSelectElement>(".wd-panel-form-input")!;
  select.value = value;
  submitForm(toolbox);
}

function clickNext(nextControl: HTMLElement): void {
  nextControl.querySelector<HTMLAnchorElement>(".wd-next-link")!.click();
}

/** the evolution step's "Confirm placement" link renders inside the mascot's speech bubble, not toolbox/nextControl */
function clickConfirm(mascotHost: HTMLElement): void {
  mascotHost.querySelector<HTMLAnchorElement>(".wd-next-link")!.click();
}

function buildScenario(onCelebrate: () => void) {
  const canvas = document.createElement("div");
  const toolbox = document.createElement("div");
  const mascotHost = document.createElement("div");
  const nextControl = document.createElement("div");
  document.body.append(canvas, toolbox, mascotHost, nextControl);
  runValueChainScenario({ canvas, toolbox, mascotHost, nextControl, onCelebrate });
  return { canvas, toolbox, mascotHost, nextControl };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** drags the Need into place (default layout's target is centerX=200, needY=76 for the default 400x300 viewBox), then clicks past the "Next" gate into the form */
async function completeDragStep(toolbox: HTMLElement, nextControl: HTMLElement): Promise<void> {
  const activeSlot = toolbox.querySelector(".wd-panel-slot--active")!;
  drag(activeSlot, { x: 200, y: 76 });
  await flush();
  clickNext(nextControl);
  await flush();
}

describe("runValueChainScenario", () => {
  it("starts with the panel's drag handle active, before any form step", () => {
    const { toolbox } = buildScenario(vi.fn());
    expect(toolbox.querySelector(".wd-panel-slot--active")).not.toBeNull();
    expect(toolbox.querySelector("form")).toBeNull();
  });

  it("fires onNeedPlaced as soon as the Need snaps, and waits for a Next click before showing the form", async () => {
    const onNeedPlaced = vi.fn();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl, onNeedPlaced });

    const activeSlot = toolbox.querySelector(".wd-panel-slot--active")!;
    drag(activeSlot, { x: 200, y: 76 });
    await flush();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(toolbox.querySelector("form")).toBeNull();
    expect(nextControl.querySelector(".wd-next-link")).not.toBeNull();

    clickNext(nextControl);
    await flush();
    expect(toolbox.querySelector("form")).not.toBeNull();
  });

  it("does not advance to the form sequence if the Need is dropped away from its target", async () => {
    const { toolbox } = buildScenario(vi.fn());
    const activeSlot = toolbox.querySelector(".wd-panel-slot--active")!;
    drag(activeSlot, { x: 0, y: 0 });
    await flush();

    expect(toolbox.querySelector(".wd-panel-slot--active")).not.toBeNull();
    expect(toolbox.querySelector("form")).toBeNull();
  });

  it("walks need -> user -> 3 capabilities after the drag step, relabeling each node as it's answered", async () => {
    const { canvas, toolbox, nextControl } = buildScenario(vi.fn());
    await completeDragStep(toolbox, nextControl);

    const need = NEED_CATALOG[0];
    submitSelect(toolbox, need.id);
    await flush();
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).toBe(need.label);

    submitText(toolbox, "A commuter");
    await flush();
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.textContent).toBe("A commuter");

    submitText(toolbox, "A kettle");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("A kettle");

    submitText(toolbox, "Water");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Water");

    submitText(toolbox, "Electricity");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Electricity");
  });

  it("shows placeholders matching the selected need, not a different need's example", async () => {
    const { toolbox, nextControl } = buildScenario(vi.fn());
    await completeDragStep(toolbox, nextControl);

    const grocery = NEED_CATALOG.find((need) => need.id === "fresh-grocery-delivery")!;
    submitSelect(toolbox, grocery.id);
    await flush();

    expect(toolbox.querySelector<HTMLInputElement>(".wd-panel-form-input")!.placeholder).toBe(
      grocery.userPlaceholder,
    );
    submitText(toolbox, "A home cook");
    await flush();

    for (const placeholder of grocery.capabilityPlaceholders) {
      expect(toolbox.querySelector<HTMLInputElement>(".wd-panel-form-input")!.placeholder).toBe(placeholder);
      submitText(toolbox, "answer");
      await flush();
    }
  });

  it("empties the panel to a full-height placeholder and fires onCelebrate once the last capability is answered", async () => {
    const onCelebrate = vi.fn();
    const { toolbox, nextControl } = buildScenario(onCelebrate);
    await completeDragStep(toolbox, nextControl);
    expect(onCelebrate).not.toHaveBeenCalled();

    submitSelect(toolbox, NEED_CATALOG[0].id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();
    submitText(toolbox, "A kettle");
    await flush();
    submitText(toolbox, "Water");
    await flush();
    expect(onCelebrate).not.toHaveBeenCalled();

    submitText(toolbox, "Electricity");
    await flush();

    expect(toolbox.querySelector(".wd-panel-content")).not.toBeNull();
    expect(toolbox.querySelector("form")).toBeNull();
    expect(onCelebrate).toHaveBeenCalledOnce();
  });

  it("shows a second Next link after celebrating, reveals the map backdrop only once it's clicked, and fires onEvolutionReady", async () => {
    const onEvolutionReady = vi.fn();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl, onEvolutionReady });
    await completeDragStep(toolbox, nextControl);

    submitSelect(toolbox, NEED_CATALOG[0].id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();
    submitText(toolbox, "A kettle");
    await flush();
    submitText(toolbox, "Water");
    await flush();
    submitText(toolbox, "Electricity");
    await flush();

    expect(nextControl.querySelector(".wd-next-link")).not.toBeNull();
    expect(onEvolutionReady).not.toHaveBeenCalled();
    expect(canvas.querySelector(".wd-backdrop")).toBeNull();

    vi.useFakeTimers();
    clickNext(nextControl);
    await flush();

    expect(canvas.querySelector(".wd-backdrop")).not.toBeNull();

    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(nextControl.querySelector(".wd-next-link")).toBeNull();

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

  it("mounts the mascot into mascotHost only once Phase 2 begins, swapping in a Need-label/Genesis bubble", async () => {
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl });
    await completeDragStep(toolbox, nextControl);

    const need = NEED_CATALOG[0];
    submitSelect(toolbox, need.id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();
    submitText(toolbox, "A kettle");
    await flush();
    submitText(toolbox, "Water");
    await flush();
    submitText(toolbox, "Electricity");
    await flush();

    expect(mascotHost.querySelector(".wd-mascot")).toBeNull();

    clickNext(nextControl);
    await flush();

    expect(mascotHost.querySelector(".wd-mascot")).not.toBeNull();
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(need.label);
    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Genesis?");
  });

  /** walks the Phase 1 form and clicks past the Phase 1->2 gate, landing right where the Need starts beckoning on the map (default layout's Genesis x is 50, at the Need's unchanged y of 76) */
  async function reachEvolutionStep(toolbox: HTMLElement, nextControl: HTMLElement): Promise<void> {
    await completeDragStep(toolbox, nextControl);
    submitSelect(toolbox, NEED_CATALOG[0].id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();
    submitText(toolbox, "A kettle");
    await flush();
    submitText(toolbox, "Water");
    await flush();
    submitText(toolbox, "Electricity");
    await flush();
    clickNext(nextControl);
    await flush();
    vi.advanceTimersByTime(MAP_CAPTION_FADE_MS);
  }

  it("doesn't show a confirm link until the Need is dragged at least once", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl });
    await reachEvolutionStep(toolbox, nextControl);

    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 150, y: 76 });
    await flush();

    const confirmLink = mascotHost.querySelector<HTMLAnchorElement>(".wd-next-link");
    expect(confirmLink).not.toBeNull();
    expect(confirmLink!.textContent).toBe("Confirm placement");
    vi.useRealTimers();
  });

  it("updates the mascot bubble's subheading live as the Need is dragged, and moves on to Capability-1 once the confirm link is clicked", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    let resolved = false;
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(toolbox, nextControl);

    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Genesis?");

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 250, y: 76 });
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Product?");
    expect(resolved).toBe(false);

    clickConfirm(mascotHost);
    await flush();

    // the scenario doesn't resolve yet — Capability-1/2/3 still have to go through
    // the same drag-confirm pattern before the whole thing is done
    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("A kettle");
    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Genesis?");
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
    clickConfirm(mascotHost);
    await flush();
  }

  it("slides each capability into the Genesis column and walks Capability-1/2/3 through the same drag-confirm pattern, celebrating once all four are placed", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    let resolved = false;
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(toolbox, nextControl);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("A kettle");
    expect(canvas.querySelector('[data-node-id="dependency-1"]')!.getAttribute("transform")).toMatch(
      /^translate\(50,/,
    );

    await confirmEvolutionStep(canvas, mascotHost, "dependency-1", 150, 157);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Water");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, mascotHost, "dependency-2", 150, 157);
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Electricity");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, mascotHost, "dependency-3", 150, 157);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Wardley Map");
    expect(resolved).toBe(false);

    // the placement finale's confirm link starts Phase 3's Q&A rather than resolving the scenario
    clickConfirm(mascotHost);
    await flush();

    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(BIAS_CHECK_QUESTION.prompt);
    vi.useRealTimers();
  });

  /** walks placement through the Phase 2->3 gate, landing on Capability 1's bias-check question */
  async function reachThinkingStep(
    canvas: HTMLElement,
    toolbox: HTMLElement,
    mascotHost: HTMLElement,
    nextControl: HTMLElement,
  ): Promise<void> {
    await reachEvolutionStep(toolbox, nextControl);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-1", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-2", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-3", 150, 157);
    clickConfirm(mascotHost);
    await flush();
  }

  function clickOption(mascotHost: HTMLElement, index = 0): void {
    mascotHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option")[index].click();
  }

  it("asks the bias-check question for Capability 1, the build/buy/outsource question for Capability 2, and a pool question for Capability 3", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl });
    await reachThinkingStep(canvas, toolbox, mascotHost, nextControl);

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
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl });
    await reachThinkingStep(canvas, toolbox, mascotHost, nextControl);

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
    const toolbox = document.createElement("div");
    const mascotHost = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, mascotHost, nextControl);
    let resolved = false;
    runValueChainScenario({ canvas, toolbox, mascotHost, nextControl }).then(() => {
      resolved = true;
    });
    await reachThinkingStep(canvas, toolbox, mascotHost, nextControl);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(1);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(2);

    clickOption(mascotHost);
    await flush();
    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(3);

    const finalLink = mascotHost.querySelector<HTMLAnchorElement>(".wd-next-link")!;
    expect(finalLink.textContent).toBe("What's next →");
    finalLink.click();
    await flush();

    expect(resolved).toBe(true);
    vi.useRealTimers();
  });

  it("does not advance on a whitespace-only capability answer", async () => {
    const { toolbox, nextControl } = buildScenario(vi.fn());
    await completeDragStep(toolbox, nextControl);
    submitSelect(toolbox, NEED_CATALOG[0].id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();

    submitText(toolbox, "   ");
    await flush();

    expect(toolbox.querySelector(".wd-panel-form-prompt")!.textContent).toBe(
      "What's something they depend on to get this need met? \r\n(1 of 3)",
    );
  });
});
