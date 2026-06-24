import { describe, expect, it, vi } from "vitest";
import { runValueChainScenario } from "./userNeedDependency";
import { NEED_CATALOG } from "../domain/needCatalog";

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

function buildScenario(onCelebrate: () => void) {
  const canvas = document.createElement("div");
  const toolbox = document.createElement("div");
  document.body.append(canvas, toolbox);
  runValueChainScenario({ canvas, toolbox, onCelebrate });
  return { canvas, toolbox };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("runValueChainScenario", () => {
  it("walks need -> user -> 3 capabilities, relabeling each node as it's answered", async () => {
    const { canvas, toolbox } = buildScenario(vi.fn());
    await flush();

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

  it("clears the panel and fires onCelebrate once the last capability is answered", async () => {
    const onCelebrate = vi.fn();
    const { toolbox } = buildScenario(onCelebrate);
    await flush();

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

    expect(toolbox.children.length).toBe(0);
    expect(onCelebrate).toHaveBeenCalledOnce();
  });

  it("does not advance on a whitespace-only capability answer", async () => {
    const { toolbox } = buildScenario(vi.fn());
    await flush();
    submitSelect(toolbox, NEED_CATALOG[0].id);
    await flush();
    submitText(toolbox, "A commuter");
    await flush();

    submitText(toolbox, "   ");
    await flush();

    expect(toolbox.querySelector(".wd-panel-form-prompt")!.textContent).toBe(
      "What's something they depend on to get this? (1 of 3)",
    );
  });
});
