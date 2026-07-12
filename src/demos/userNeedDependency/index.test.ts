import { describe, expect, it, vi } from "vitest";
import { runValueChainScenario } from "./index";
import { NEED_CATALOG } from "../../domain/needCatalog";
import { METHOD_QUESTION } from "../../domain/questionBank";
import { CONCEPT_BANK } from "../../domain/conceptBank";
import { CELEBRATE_DURATION_MS } from "./phase7";

function gatePrompt(conceptId: string, nodeLabel: string): string {
  const concept = CONCEPT_BANK.find((c) => c.id === conceptId)!;
  return `${concept.definition}\n\nDo you think we could learn something from exploring ${concept.label} with ${nodeLabel}?`;
}

function drag(handle: Element, to: { x: number; y: number }): void {
  handle.dispatchEvent(new PointerEvent("pointerdown", { clientX: 0, clientY: 0, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 }));
  handle.dispatchEvent(new PointerEvent("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 }));
}

/** clicks a `type: "choice"` field's pill option matching `label` exactly (every Phase 10 field -- no text input to type into, see panel.ts) */
function chooseOption(mascotHost: HTMLElement, label: string): void {
  const chip = Array.from(mascotHost.querySelectorAll<HTMLButtonElement>(".wd-panel-form-example")).find(
    (button) => button.textContent === label,
  )!;
  chip.click();
}

/** every gate/confirm link (every "Next" click point in the scenario) renders either beside the
 * mascot's avatar (a brief caption) or inside its dialog panel -- `mascotHost` below is a
 * synthetic wrapper around both real hosts, so a plain querySelector finds it either way */
function clickNext(mascotHost: HTMLElement): void {
  mascotHost.querySelector<HTMLButtonElement>(".wd-next-link")!.click();
}

/**
 * builds the two real hosts (`avatarHost`/`dialogHost`) the scenario needs, wrapped in one parent
 * div bound to `mascotHost` for every helper/assertion below -- none of them care which of the two
 * subtrees a given render actually lands in, they just need *a* container whose querySelector
 * covers both.
 */
function makeMascotHosts(): { mascotHost: HTMLElement; avatarHost: HTMLElement; dialogHost: HTMLElement } {
  const mascotHost = document.createElement("div");
  const avatarHost = document.createElement("div");
  const dialogHost = document.createElement("div");
  mascotHost.append(avatarHost, dialogHost);
  return { mascotHost, avatarHost, dialogHost };
}

function buildScenario(onCelebrate: () => void) {
  const canvas = document.createElement("div");
  const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
  document.body.append(canvas, mascotHost);
  runValueChainScenario({ canvas, avatarHost, dialogHost, onCelebrate });
  return { canvas, mascotHost };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** waits out Phase 7's post-click "celebrating" pose (a real `setTimeout` for `CELEBRATE_DURATION_MS`, held so the bounce is visible before Phase 10 starts) -- via fake-timer advancement if the calling test has `vi.useFakeTimers()` active, or a real wait otherwise */
async function passCelebrateDelay(): Promise<void> {
  if (vi.isFakeTimers()) {
    await vi.advanceTimersByTimeAsync(CELEBRATE_DURATION_MS);
  } else {
    await new Promise((resolve) => setTimeout(resolve, CELEBRATE_DURATION_MS));
  }
}

/** drags the Need into place (default layout's target is centerX=200, needY=76 for the default 400x300 viewBox), then clicks past its seven "Next" gates (Phase 0's opening caption, then Phase 5's User/Need/Capability captions and its two-caption "recipe" beat) and Phase 7's single "I'm Ben" introduction gate into the form */
async function completeDragStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
  const needNode = canvas.querySelector('[data-node-id="need"]')!;
  drag(needNode, { x: 200, y: 76 });
  await flush();
  for (let i = 0; i < 7; i++) {
    clickNext(mascotHost);
    await flush();
  }
  await passCelebrateDelay();
}

describe("runValueChainScenario", () => {
  it("renders the Need already on the canvas, out of place, beckoning, and labelless, with a directional-arrow cue and no mascot yet", () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    expect(needNode.classList.contains("wd-node--beckon")).toBe(true);
    expect(needNode.getAttribute("transform")).not.toBe("translate(200, 76)");
    expect(canvas.querySelector(".wd-direction-arrow")).not.toBeNull();
    expect(needNode.querySelector(".wd-node-label")!.classList.contains("wd-node-label--hidden")).toBe(true);
    expect(mascotHost.querySelector(".wd-mascot")).toBeNull();
    expect(mascotHost.querySelector("form")).toBeNull();
  });

  it("fires onNeedPlaced as soon as the Need snaps, mounts the mascot, removes the arrow cue, reveals every node's label, and shows the Value Chain caption", async () => {
    const onNeedPlaced = vi.fn();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost, onNeedPlaced });

    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 200, y: 76 });
    await flush();

    expect(onNeedPlaced).toHaveBeenCalledOnce();
    expect(canvas.querySelector(".wd-direction-arrow")).toBeNull();
    expect(mascotHost.querySelector(".wd-mascot")).not.toBeNull();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(needNode.querySelector(".wd-node-label")!.classList.contains("wd-node-label--hidden")).toBe(false);
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.classList.contains("wd-node-label--hidden")).toBe(
      false,
    );
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "Oh cool! I see you just made a Value Chain — a recipe for delivering value.",
    );
    const gateLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(gateLink).not.toBeNull();
    expect(gateLink!.textContent).toBe("Next");
  });

  it("walks the user through User/Need/Capability, says the recipe line before relabeling, then relabels the three Capability nodes to Part A/B/C right as it explains multi-part needs, and has the mascot introduce itself before the form", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 200, y: 76 });
    await flush();
    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "This is a User. In a value chain, it's who we choose to help.",
    );

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "This is a User Need. It's what the user expects to get.",
    );

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "This is a Capability. It's how we meet the user need.",
    );

    clickNext(mascotHost);
    await flush();

    // the recipe beat is said before the three Capability nodes are relabeled -- they're still
    // under their generic placeholder label at this point
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("A Value Chain is like a recipe.");
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("Capability");
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Capability");
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Capability");

    clickNext(mascotHost);
    await flush();
    // relabeled to Part A/B/C right as the row grows/second caption plays, not delayed further
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "It often takes multiple capabilities to come together to meet the user need.",
    );
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("Part A");
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Part B");
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Part C");

    clickNext(mascotHost);
    await flush();
    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "I'm Ben, by the way. I'm here to help you learn Wardley Mapping!",
    );

    clickNext(mascotHost);
    await flush();
    await passCelebrateDelay();
    expect(mascotHost.querySelector(".wd-panel-form")).not.toBeNull();
    expect(mascotHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who should we help today?");
  });

  it("with a host config that renders only one Capability node, says the recipe line while still one node, then grows the row to three already labeled Part A/B/C as it explains why", async () => {
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({
      canvas,
      avatarHost,
      dialogHost,
      onCelebrate: vi.fn(),
      config: {
        viewBox: { width: 400, height: 520 },
        snapThreshold: 30,
        nodes: [
          { id: "user", label: "Someone we care about", x: 200, y: 100, draggable: false },
          { id: "need", label: "Something they need", x: 200, y: 284, draggable: true, start: { x: 25, y: 237 } },
          { id: "dependency-1", label: "Something that satisfies their need", x: 200, y: 468, draggable: false },
        ],
        connections: [
          { from: "user", to: "need" },
          { from: "need", to: "dependency-1" },
        ],
      },
    });

    const needNode = canvas.querySelector('[data-node-id="need"]')!;
    drag(needNode, { x: 200, y: 284 });
    await flush();
    for (let i = 0; i < 3; i++) {
      clickNext(mascotHost);
      await flush();
    }
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "This is a Capability. It's how we meet the user need.",
    );

    clickNext(mascotHost);
    await flush();

    // the recipe line is said while the row still shows only the one Capability the host config
    // rendered -- the other two haven't faded in yet
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("A Value Chain is like a recipe.");
    expect(canvas.querySelectorAll('[data-node-id^="dependency-"]')).toHaveLength(1);

    clickNext(mascotHost);
    await flush();

    // the row grows to three, already relabeled Part A/B/C by final screen position, right as the
    // second caption explains why -- the pre-existing dependency-1 node (screen-center, x: 200)
    // loses its original label too, not just the two newly-faded-in nodes either side of it
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "It often takes multiple capabilities to come together to meet the user need.",
    );
    expect(canvas.querySelectorAll('[data-node-id^="dependency-"]')).toHaveLength(3);
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("Part B");
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Part A");
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Part C");
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

    chooseOption(mascotHost, "Commuter");
    await flush();
    expect(canvas.querySelector('[data-node-id="user"] .wd-node-label')!.textContent).toBe("Commuter");

    const need = NEED_CATALOG[0];
    chooseOption(mascotHost, need.label);
    await flush();
    expect(canvas.querySelector('[data-node-id="need"] .wd-node-label')!.textContent).toBe(need.label);

    chooseOption(mascotHost, "Kettle");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-1"] .wd-node-label')!.textContent).toBe("Kettle");

    chooseOption(mascotHost, "Water");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-2"] .wd-node-label')!.textContent).toBe("Water");

    chooseOption(mascotHost, "Electricity");
    await flush();
    expect(canvas.querySelector('[data-node-id="dependency-3"] .wd-node-label')!.textContent).toBe("Electricity");
  });

  it("shows capability pills matching the selected need, not a different need's example, with no free-text input", async () => {
    const { canvas, mascotHost } = buildScenario(vi.fn());
    await completeDragStep(canvas, mascotHost);

    chooseOption(mascotHost, "Home Cook");
    await flush();

    const grocery = NEED_CATALOG.find((need) => need.id === "fresh-grocery-delivery")!;
    chooseOption(mascotHost, grocery.label);
    await flush();

    for (let i = 0; i < 3; i++) {
      expect(mascotHost.querySelector(".wd-panel-form-input")).toBeNull();
      const pillLabels = Array.from(mascotHost.querySelectorAll(".wd-panel-form-example")).map(
        (chip) => chip.textContent,
      );
      for (const label of pillLabels) {
        expect(grocery.capabilityOptions).toContain(label);
      }
      chooseOption(mascotHost, pillLabels[0]!);
      await flush();
    }
  });

  it("shows a 'Value Chain done!' caption and fires onCelebrate once the last capability is answered", async () => {
    const onCelebrate = vi.fn();
    const { canvas, mascotHost } = buildScenario(onCelebrate);
    await completeDragStep(canvas, mascotHost);
    expect(onCelebrate).not.toHaveBeenCalled();

    chooseOption(mascotHost, "Commuter");
    await flush();
    chooseOption(mascotHost, NEED_CATALOG[0].label);
    await flush();
    chooseOption(mascotHost, "Kettle");
    await flush();
    chooseOption(mascotHost, "Water");
    await flush();
    expect(onCelebrate).not.toHaveBeenCalled();

    chooseOption(mascotHost, "Electricity");
    await flush();

    expect(mascotHost.querySelector("form")).toBeNull();
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "Value Chain done! Now let's turn this into a Wardley Map.",
    );
    expect(onCelebrate).toHaveBeenCalledOnce();
  });

  it("shows a second Next link after celebrating, reveals the map backdrop and fires onEvolutionReady once it's clicked, then gates the first drag behind an evolution-intro beat", async () => {
    const onEvolutionReady = vi.fn();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost, onEvolutionReady });
    await completeDragStep(canvas, mascotHost);

    chooseOption(mascotHost, "Commuter");
    await flush();
    chooseOption(mascotHost, NEED_CATALOG[0].label);
    await flush();
    chooseOption(mascotHost, "Kettle");
    await flush();
    chooseOption(mascotHost, "Water");
    await flush();
    chooseOption(mascotHost, "Electricity");
    await flush();

    expect(mascotHost.querySelector(".wd-next-link")).not.toBeNull();
    expect(onEvolutionReady).not.toHaveBeenCalled();
    expect(canvas.querySelector(".wd-backdrop")).toBeNull();

    clickNext(mascotHost);
    await flush();

    // the map backdrop and onEvolutionReady both land on this first click -- the evolution-intro
    // beat below is shown once the map is already visible, not gating the reveal itself
    expect(canvas.querySelector(".wd-backdrop")).not.toBeNull();
    expect(onEvolutionReady).toHaveBeenCalledOnce();
    expect(canvas.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(canvas.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(false);

    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "Everything evolves. As things evolve, they change! And that means the way we treat them should change, too.",
    );
    // the Need doesn't beckon or slide to Genesis until this beat is confirmed
    expect(canvas.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--beckon")).toBe(false);
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).not.toMatch(/^translate\(50,/);

    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();
    expect(canvas.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--beckon")).toBe(true);
    // no artificial stagger anymore -- the Need settles into Genesis as soon as this gate resolves
    expect(canvas.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toMatch(/^translate\(50,/);
  });

  it("does not mount the mascot until the Need is placed, then swaps in a Need-label/Genesis instrument panel once Phase 20 begins", async () => {
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });

    expect(mascotHost.querySelector(".wd-mascot")).toBeNull();

    await completeDragStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-mascot")).not.toBeNull();

    const need = NEED_CATALOG[0];
    chooseOption(mascotHost, "Commuter");
    await flush();
    chooseOption(mascotHost, need.label);
    await flush();
    chooseOption(mascotHost, "Kettle");
    await flush();
    chooseOption(mascotHost, "Water");
    await flush();
    chooseOption(mascotHost, "Electricity");
    await flush();

    clickNext(mascotHost);
    await flush();
    clickNext(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe(
      `Is ${need.label} in Genesis?`,
    );
  });

  /** walks the Phase 10 form and clicks past the Phase 10->20 gate and the evolution-intro gate, landing right where the Need starts beckoning on the map (default layout's Genesis x is 50, at the Need's unchanged y of 76) */
  async function reachEvolutionStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
    await completeDragStep(canvas, mascotHost);
    chooseOption(mascotHost, "Commuter");
    await flush();
    chooseOption(mascotHost, NEED_CATALOG[0].label);
    await flush();
    chooseOption(mascotHost, "Kettle");
    await flush();
    chooseOption(mascotHost, "Water");
    await flush();
    chooseOption(mascotHost, "Electricity");
    await flush();
    clickNext(mascotHost);
    await flush();
    clickNext(mascotHost);
    await flush();
  }

  it("doesn't show a confirm link until the Need is dragged at least once", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachEvolutionStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-next-link")).toBeNull();

    drag(canvas.querySelector('[data-node-id="need"]')!, { x: 150, y: 76 });
    await flush();

    const confirmLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    expect(confirmLink).not.toBeNull();
    expect(confirmLink!.textContent).toBe("Confirm placement");
    vi.useRealTimers();
  });

  it("updates the instrument panel live as the Need is dragged, and moves on to Capability-1 once the confirm link is clicked", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, avatarHost, dialogHost }).then(() => {
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
    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is Kettle in Genesis?");
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
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, avatarHost, dialogHost }).then(() => {
      resolved = true;
    });
    await reachEvolutionStep(canvas, mascotHost);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is Kettle in Genesis?");
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

    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("You made a Wardley Map!");
    expect(resolved).toBe(false);

    // the placement finale's confirm link lands on Phase 25's explanation rather than resolving the scenario
    clickNext(mascotHost);
    await flush();

    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe(
      "Use the map to think To make a strategy, we ask the map special questions that help us think strategically. ",
    );

    // Phase 25's own confirm link starts Phase 30's Q&A, opening on the first concept/node gate --
    // Phase 30 picks that opening pairing at random, so pin Math.random to land on index 0
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    clickNext(mascotHost);
    await flush();
    randomSpy.mockRestore();

    expect(resolved).toBe(false);
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("right-methods", "Kettle"),
    );
    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "Choosing is how you learn!",
    );
    vi.useRealTimers();
  });

  /** walks placement through the Phase 20->25->30 gates, landing on the first concept/node gate ("using the right methods" x Capability 1) -- "novelty bias" is restricted to Product/Commodity nodes (`applicableStages`), and every node here lands at Custom-Built (each dragged to x=150 in a 400-wide viewBox), so it has no candidates and is skipped entirely. Phase 30 picks its opening pairing at random (`Math.random`), so `Math.random` is pinned to 0 for the single call that makes that pick -- `Math.floor(0 * remaining.length)` is index 0, the same pairing every other test in this file already expects -- and released immediately after so later shuffle/randomness in the same test stays genuinely random. */
  async function reachThinkingStep(canvas: HTMLElement, mascotHost: HTMLElement): Promise<void> {
    await reachEvolutionStep(canvas, mascotHost);
    await confirmEvolutionStep(canvas, mascotHost, "need", 150, 76);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-1", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-2", 150, 157);
    await confirmEvolutionStep(canvas, mascotHost, "dependency-3", 150, 157);
    clickNext(mascotHost);
    await flush();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    clickNext(mascotHost);
    await flush();
    randomSpy.mockRestore();
  }

  function clickOption(mascotHost: HTMLElement, index = 0): void {
    mascotHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option")[index].click();
  }

  /** the concept/node pairing gate always renders Yes/No/"Try something else" first, in that order (plus a trailing "Finish Up" once a finding exists) */
  function clickYes(mascotHost: HTMLElement): void {
    clickOption(mascotHost, 0);
  }
  function clickNo(mascotHost: HTMLElement): void {
    clickOption(mascotHost, 1);
  }
  function clickShuffle(mascotHost: HTMLElement): void {
    clickOption(mascotHost, 2);
  }
  function optionLabels(mascotHost: HTMLElement): (string | null)[] {
    return Array.from(mascotHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option")).map(
      (b) => b.textContent,
    );
  }

  it("shows a gate for the first concept/node pairing, offering only Yes/No/Try something else, and a No skips the whole concept, switching the subtitle to 'Keep going!'", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachThinkingStep(canvas, mascotHost);

    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "Choosing is how you learn!",
    );
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("right-methods", "Kettle"),
    );
    expect(optionLabels(mascotHost)).toEqual(["Yes", "No", "Try something else"]);

    clickNo(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Keep going!");
    // No drops every remaining "right-methods" candidate, not just Kettle, so this lands on
    // the next concept in the bank ("organizational inertia"), opening on Need
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("inertia", NEED_CATALOG[0].label),
    );
    vi.useRealTimers();
  });

  it("answering Yes opens that concept's deep-dive question, and answering it anchors an annotation and, once past the 'Nice insight!' pause, advances to the next concept's gate", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachThinkingStep(canvas, mascotHost);

    clickYes(mascotHost);
    await flush();

    expect(mascotHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Kettle");
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(METHOD_QUESTION.prompt);

    clickOption(mascotHost, 2); // "No, we're using the wrong methods for this stage.", annotation "Danger: Wrong Methods"
    await flush();

    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(1);

    clickOption(mascotHost, 0); // "Keep Going" past the "Nice insight!" pause
    await flush();

    // next concept in the bank ("organizational inertia") opens on Need, since it's the first candidate
    // node in valueChainComponents order whose kind (need or capability) inertia applies to
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("inertia", NEED_CATALOG[0].label),
    );
    vi.useRealTimers();
  });

  it("'Try something else' always jumps to a different pairing than the one just shown", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachThinkingStep(canvas, mascotHost);

    for (let i = 0; i < 5; i++) {
      const before = mascotHost.querySelector(".wd-panel-question-prompt")!.textContent;
      clickShuffle(mascotHost);
      await flush();
      expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).not.toBe(before);
    }
    vi.useRealTimers();
  });

  it("pauses on a 'Nice insight!' gate right after an annotation-producing answer, and 'Keep Going' resumes the walk", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachThinkingStep(canvas, mascotHost);

    clickYes(mascotHost);
    await flush();
    clickOption(mascotHost, 2); // "Using the Right Methods" -> wrong methods, annotation "Danger: Wrong Methods"
    await flush();

    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(1);
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      "Nice insight!\n\nThis sort of thing might factor into your strategy.",
    );
    expect(optionLabels(mascotHost)).toEqual(["Keep Going", "Finish Up"]);

    clickOption(mascotHost, 0); // "Keep Going"
    await flush();

    // next concept in the bank ("organizational inertia") opens on Need, since it's the first candidate
    // node in valueChainComponents order whose kind (need or capability) inertia applies to
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("inertia", NEED_CATALOG[0].label),
    );
    vi.useRealTimers();
  });

  it("adds a 'Finish Up' option to the concept/node pairing gate once an annotation has landed, and clicking it ends the phase", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, avatarHost, dialogHost }).then(() => {
      resolved = true;
    });
    await reachThinkingStep(canvas, mascotHost);

    expect(optionLabels(mascotHost)).toEqual(["Yes", "No", "Try something else"]);

    clickYes(mascotHost);
    await flush();
    clickOption(mascotHost, 2); // "Using the Right Methods" -> wrong methods, annotation "Danger: Wrong Methods"
    await flush();
    clickOption(mascotHost, 0); // "Keep Going" past the "Nice insight!" pause
    await flush();

    // back on a concept/node pairing gate ("organizational inertia" x Need); now that a finding
    // exists, "Finish Up" is offered alongside Yes/No/Try something else
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("inertia", NEED_CATALOG[0].label),
    );
    expect(optionLabels(mascotHost)).toEqual(["Yes", "No", "Try something else", "Finish Up"]);

    clickOption(mascotHost, 3); // "Finish Up"
    await flush();

    const findingsHeading = mascotHost.querySelector(".wd-panel-findings")!.querySelector(".wd-panel-placeholder-heading");
    expect(findingsHeading!.textContent).toBe("Here's what you found, and you're barely scratching the surface!");
    expect(resolved).toBe(false); // still waiting on the Finale's own "What's next →" link
    vi.useRealTimers();
  });

  it("does not pause after an answer with a blank annotation, and unlike Done there is no settled-count threshold", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    runValueChainScenario({ canvas, avatarHost, dialogHost });
    await reachThinkingStep(canvas, mascotHost);

    clickYes(mascotHost);
    await flush();
    clickOption(mascotHost, 2); // "Using the Right Methods" -> wrong methods, annotation "Danger: Wrong Methods"
    await flush();
    clickOption(mascotHost, 0); // "Keep Going" past "right-methods"'s insight gate
    await flush();

    // "organizational inertia"'s first (auto-picked) option is "No — we are adapting readily.",
    // an intentionally blank annotation, so it falls straight through to the next gate
    clickYes(mascotHost);
    await flush();
    clickOption(mascotHost);
    await flush();

    expect(canvas.querySelectorAll(".wd-annotation").length).toBe(1);
    expect(mascotHost.querySelector(".wd-panel-question-prompt")!.textContent).toBe(
      gatePrompt("differentiation", NEED_CATALOG[0].label),
    );
    vi.useRealTimers();
  });

  it("'Finish Up' ends the phase, renders a concept-and-node-attributed findings report, and the Finale's link still appends beneath it", async () => {
    vi.useFakeTimers();
    const canvas = document.createElement("div");
    const { mascotHost, avatarHost, dialogHost } = makeMascotHosts();
    document.body.append(canvas, mascotHost);
    let resolved = false;
    runValueChainScenario({ canvas, avatarHost, dialogHost }).then(() => {
      resolved = true;
    });
    await reachThinkingStep(canvas, mascotHost);

    clickYes(mascotHost);
    await flush();
    clickOption(mascotHost, 2); // "Using the Right Methods" -> wrong methods, annotation "Danger: Wrong Methods"
    await flush();
    clickOption(mascotHost, 1); // "Finish Up"
    await flush();

    const findingsHeading = mascotHost.querySelector(".wd-panel-findings")!.querySelector(".wd-panel-placeholder-heading");
    expect(findingsHeading!.textContent).toBe("Here's what you found, and you're barely scratching the surface!");
    const items = Array.from(mascotHost.querySelectorAll(".wd-panel-findings-list li")).map((li) => li.textContent);
    expect(items).toEqual(["Using the Right Methods at Kettle"]);

    const finalLink = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link")!;
    expect(finalLink.textContent).toBe("What's next →");
    finalLink.click();
    await flush();

    expect(resolved).toBe(true);
    vi.useRealTimers();
  });
});
