import { describe, expect, it } from "vitest";
import { Panel, type PanelDragSlot } from "./panel";
import type { Question } from "../domain/questionBank";

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

  it("renders an intro heading/subheading above the slot row when given", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showDragHandles(slots, { heading: "Hi there!", subheading: "Drag the glowing circle to begin." });

    expect(container.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Hi there!");
    expect(container.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "Drag the glowing circle to begin.",
    );
    expect(container.querySelectorAll(".wd-panel-slot").length).toBe(3);
  });

  it("renders no heading/subheading when intro is omitted", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showDragHandles(slots);

    expect(container.querySelector(".wd-panel-placeholder-heading")).toBeNull();
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

  it("renders one example chip per option, and clicking one fills the input without resolving", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    const result = panel.showField({
      type: "text",
      prompt: "Pick a need",
      examples: ["Hot, drinkable tea", "A taxi to the airport"],
    });

    const chips = container.querySelectorAll<HTMLButtonElement>(".wd-panel-form-example");
    expect(chips.length).toBe(2);

    let resolved = false;
    result.then(() => {
      resolved = true;
    });

    chips[1].click();
    await Promise.resolve();
    expect(resolved).toBe(false);

    const input = container.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
    expect(input.value).toBe("A taxi to the airport");

    submitForm(container);
    expect(await result).toBe("A taxi to the airport");
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

describe("Panel.showQuestion", () => {
  const question: Question = {
    id: "q1",
    prompt: "How should you treat this?",
    options: [
      { id: "build", label: "Build it ourselves", annotation: "Build" },
      { id: "buy", label: "Buy a product", annotation: "Buy" },
    ],
  };
  const otherQuestion: Question = {
    id: "q2",
    prompt: "Is there inertia here?",
    options: [{ id: "no", label: "No inertia", annotation: "No inertia" }],
  };

  it("renders the heading, prompt, and one button per option", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showQuestion("Capability", question);

    expect(container.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Capability");
    expect(container.querySelector(".wd-panel-question-prompt")!.textContent).toBe(question.prompt);
    const buttons = container.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    expect([...buttons].map((b) => b.textContent)).toEqual(["Build it ourselves", "Buy a product"]);
  });

  it("resolves with the chosen option when its button is clicked", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    const result = panel.showQuestion("Capability", question);

    const buttons = container.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    buttons[1].click();

    expect(await result).toEqual(question.options[1]);
  });

  it("does not render a reroll link when onReroll is omitted", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showQuestion("Capability", question);

    expect(container.querySelector(".wd-panel-question-reroll")).toBeNull();
  });

  it("reroll swaps in the replacement question's prompt/options without resolving", async () => {
    const container = makeContainer();
    const panel = new Panel(container);
    let resolved = false;
    const result = panel.showQuestion("Capability", question, { onReroll: () => otherQuestion });
    result.then(() => {
      resolved = true;
    });

    const reroll = container.querySelector<HTMLAnchorElement>(".wd-panel-question-reroll")!;
    reroll.click();
    await Promise.resolve();

    expect(resolved).toBe(false);
    expect(container.querySelector(".wd-panel-question-prompt")!.textContent).toBe(otherQuestion.prompt);
    const buttons = container.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    expect([...buttons].map((b) => b.textContent)).toEqual(["No inertia"]);

    buttons[0].click();
    expect(await result).toEqual(otherQuestion.options[0]);
  });
});

describe("Panel.updatePlaceholderSubheading", () => {
  it("updates the subheading text of an already-rendered placeholder", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showPlaceholder("Hot, drinkable tea", "Genesis");

    panel.updatePlaceholderSubheading("Custom-Built");

    expect(container.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Custom-Built");
    expect(container.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Hot, drinkable tea");
  });

  it("is a no-op if the panel isn't currently showing a placeholder", () => {
    const container = makeContainer();
    const panel = new Panel(container);
    panel.showEmpty();

    expect(() => panel.updatePlaceholderSubheading("Product")).not.toThrow();
  });
});
