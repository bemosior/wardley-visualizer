import { describe, expect, it } from "vitest";
import { Panel, type PanelDragSlot } from "./panel";

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/** happy-dom doesn't implement HTMLFormElement.requestSubmit; dispatch the event it relies on directly */
function submitForm(container: HTMLElement): void {
  container.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
}

describe("Panel.showDragHandles", () => {
  const slots: PanelDragSlot[] = [
    { id: "user", iconText: "User", label: "Who It's For", active: false },
    { id: "need", iconText: "User Need", label: "What They Get", active: true },
    { id: "capability", iconText: "Capability", label: "How They Get It", active: false },
  ];

  it("renders one slot per descriptor", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showDragHandles(slots);

    expect(container.querySelectorAll(".wd-panel-slot").length).toBe(3);
  });

  it("returns the active slot's element as the drag handle", () => {
    const panel = new Panel(makeContainer());
    const handle = panel.showDragHandles(slots);

    expect(handle.activeElement.classList.contains("wd-panel-slot--active")).toBe(true);
    expect(handle.activeElement.title).toBe("Drag this onto the canvas");
  });

  it("complete() marks the active slot inert", () => {
    const panel = new Panel(makeContainer());
    const handle = panel.showDragHandles(slots);
    handle.complete();

    expect(handle.activeElement.classList.contains("wd-panel-slot--active")).toBe(false);
    expect(handle.activeElement.title).toBe("Not available yet");
  });

  it("throws if no slot is active", () => {
    const panel = new Panel(makeContainer());
    const allInactive = slots.map((s) => ({ ...s, active: false }));

    expect(() => panel.showDragHandles(allInactive)).toThrow();
  });

  it("silently keeps the last active slot if more than one is marked active (current behavior — contradicts the docstring's 'exactly one' invariant)", () => {
    const panel = new Panel(makeContainer());
    const twoActive = [{ ...slots[0], active: true }, slots[1], slots[2]];
    const handle = panel.showDragHandles(twoActive);

    expect(handle.activeElement.title).toBe("Drag this onto the canvas");
  });
});

describe("Panel.showField", () => {
  it("does not resolve on a whitespace-only submission", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    let resolved = false;
    panel.showField({ type: "text", prompt: "Who has this need?" }).then(() => {
      resolved = true;
    });

    const input = container.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
    input.value = "   ";
    submitForm(container);
    await Promise.resolve();

    expect(resolved).toBe(false);
  });

  it("resolves with the trimmed value on a non-empty text submission", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    const result = panel.showField({ type: "text", prompt: "Who has this need?" });

    const input = container.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
    input.value = "  Ben  ";
    submitForm(container);

    expect(await result).toBe("Ben");
  });

  it("renders select options and resolves with the chosen value", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    const result = panel.showField({
      type: "select",
      prompt: "Pick a need",
      options: [
        { value: "tea", label: "Hot, drinkable tea" },
        { value: "taxi", label: "A taxi to the airport" },
      ],
    });

    const select = container.querySelector<HTMLSelectElement>(".wd-panel-form-input")!;
    expect(select.options.length).toBe(2);
    select.value = "taxi";
    submitForm(container);

    expect(await result).toBe("taxi");
  });
});

describe("Panel.clear", () => {
  it("empties the container", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showField({ type: "text", prompt: "Who has this need?" });

    panel.clear();

    expect(container.children.length).toBe(0);
  });
});

describe("Panel.showEmpty", () => {
  it("replaces any prior content with an empty .wd-panel-content placeholder", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showField({ type: "text", prompt: "Who has this need?" });

    panel.showEmpty();

    expect(container.children.length).toBe(1);
    const content = container.querySelector(".wd-panel-content");
    expect(content).not.toBeNull();
    expect(content!.children.length).toBe(0);
  });
});

describe("Panel.showPlaceholder", () => {
  it("renders the heading and subheading inside a .wd-panel-content placeholder", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showField({ type: "text", prompt: "Who has this need?" });

    panel.showPlaceholder("Hot, drinkable tea", "Genesis");

    const content = container.querySelector(".wd-panel-content");
    expect(content).not.toBeNull();
    expect(container.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Hot, drinkable tea");
    expect(container.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Genesis");
  });
});
