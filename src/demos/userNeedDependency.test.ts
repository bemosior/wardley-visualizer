import { describe, expect, it, vi } from "vitest";
import { runValueChainScenario } from "./userNeedDependency";
import { MAP_CAPTION_FADE_MS } from "../engine/WardleyDemo";
import { NEED_CATALOG } from "../domain/needCatalog";

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

/** the evolution step's "Confirm placement" link renders inside the Toolbox, not nextControl */
function clickConfirm(toolbox: HTMLElement): void {
  toolbox.querySelector<HTMLAnchorElement>(".wd-next-link")!.click();
}

function buildScenario(onCelebrate: () => void) {
  const canvas = document.createElement("div");
  const toolbox = document.createElement("div");
  const nextControl = document.createElement("div");
  document.body.append(canvas, toolbox, nextControl);
  runValueChainScenario({ canvas, toolbox, nextControl, onCelebrate });
  return { canvas, toolbox, nextControl };
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
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    runValueChainScenario({ canvas, toolbox, nextControl, onNeedPlaced });

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
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    runValueChainScenario({ canvas, toolbox, nextControl, onEvolutionReady });
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

    // the slide to Genesis is staggered behind the Toolbox placeholder's own fade-in delay
    // (MAP_CAPTION_FADE_MS), not immediate
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).not.toMatch(/^translate\(50,/);
    vi.advanceTimersByTime(MAP_CAPTION_FADE_MS);
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toMatch(/^translate\(50,/);
    vi.useRealTimers();
  });

  it("swaps the Toolbox to a Need-label/Genesis placeholder once Phase 2 begins", async () => {
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    runValueChainScenario({ canvas, toolbox, nextControl });
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

    clickNext(nextControl);
    await flush();

    expect(toolbox.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(need.label);
    expect(toolbox.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Genesis");
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
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    runValueChainScenario({ canvas, toolbox, nextControl });
    await reachEvolutionStep(toolbox, nextControl);

    expect(toolbox.querySelector(".wd-next-link")).toBeNull();

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 150, y: 76 });
    await flush();

    const confirmLink = toolbox.querySelector<HTMLAnchorElement>(".wd-next-link");
    expect(confirmLink).not.toBeNull();
    expect(confirmLink!.textContent).toBe("Confirm placement");
    vi.useRealTimers();
  });

  it("updates the Toolbox subheading live as the Need is dragged, and moves on to Capability-1 once the confirm link is clicked", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    let resolved = false;
    runValueChainScenario({ canvas, toolbox, nextControl }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(toolbox, nextControl);

    expect(toolbox.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Genesis");

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 250, y: 76 });
    await flush();

    expect(toolbox.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Product");
    expect(resolved).toBe(false);

    clickConfirm(toolbox);
    await flush();

    // the scenario doesn't resolve yet — Capability-1/2/3 still have to go through
    // the same drag-confirm pattern before the whole thing is done
    expect(resolved).toBe(false);
    expect(toolbox.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("A kettle");
    expect(toolbox.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Genesis");
    vi.useRealTimers();
  });

  /** drags a node to (x, y) and clicks the resulting "Confirm placement" link — the same pattern used for the Need and each capability's evolution step */
  async function confirmEvolutionStep(
    canvas: HTMLElement,
    toolbox: HTMLElement,
    nodeId: string,
    x: number,
    y: number,
  ): Promise<void> {
    drag(canvas.querySelector(`[data-node-id="${nodeId}"]`)!, { x, y });
    await flush();
    clickConfirm(toolbox);
    await flush();
  }

  it("slides each capability into the Genesis column and walks Capability-1/2/3 through the same drag-confirm pattern, celebrating once all four are placed", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const toolbox = document.createElement("div");
    const nextControl = document.createElement("div");
    document.body.append(canvas, toolbox, nextControl);
    let resolved = false;
    runValueChainScenario({ canvas, toolbox, nextControl }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(toolbox, nextControl);
    await confirmEvolutionStep(canvas, toolbox, "need", 150, 76);

    expect(toolbox.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("A kettle");
    expect(canvas.querySelector('[data-node-id="dependency-1"]')!.getAttribute("transform")).toMatch(
      /^translate\(50,/,
    );

    await confirmEvolutionStep(canvas, toolbox, "dependency-1", 150, 157);
    expect(toolbox.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Water");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, toolbox, "dependency-2", 150, 157);
    expect(toolbox.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Electricity");
    expect(resolved).toBe(false);

    await confirmEvolutionStep(canvas, toolbox, "dependency-3", 150, 157);

    expect(resolved).toBe(true);
    expect(toolbox.querySelector(".wd-panel-placeholder-heading")).toBeNull();
    expect(toolbox.querySelector(".wd-panel-content")).not.toBeNull();
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
