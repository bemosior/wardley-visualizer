import { describe, expect, it, vi } from "vitest";
import { Mascot } from "./mascot";
import { WardleyDemo } from "./WardleyDemo";
import type { Question } from "../domain/questionBank";

function makeHost(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function buildDemo(): WardleyDemo {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return WardleyDemo.mount(container, {
    viewBox: { width: 400, height: 300 },
    nodes: [{ id: "need", label: "Need", x: 200, y: 150, draggable: false }],
    connections: [],
    snapThreshold: 30,
  });
}

describe("Mascot.mount / unmount", () => {
  it("appends the mascot root into the host on mount", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());

    mascot.mount();

    expect(host.querySelector(".wd-mascot")).not.toBeNull();
    expect(host.querySelector(".wd-mascot-avatar")).not.toBeNull();
    expect(host.querySelector(".wd-mascot-bubble")).not.toBeNull();
  });

  it("removes the mascot root on unmount", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();

    mascot.unmount();

    expect(host.querySelector(".wd-mascot")).toBeNull();
  });
});

describe("Mascot.moveTo", () => {
  it("plants the root below-and-centered on the given node, clear of its radius", () => {
    const mascot = new Mascot(makeHost(), buildDemo());

    mascot.moveTo("need", { x: 10, y: 20, radius: 50 });

    const root = (mascot as any).root as HTMLElement;
    expect(root.style.left).toBe("-10px"); // 10 - AVATAR_WIDTH / 2 (40 / 2)
    expect(root.style.top).toBe("82px"); // 20 + radius(50) + NODE_CLEARANCE(12)
  });

  it("re-tracks the last-moved node's position on window resize", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition").mockReturnValue({ x: 5, y: 6, radius: 0 });
    const host = makeHost();
    const mascot = new Mascot(host, demo);
    mascot.mount();
    mascot.moveTo("need", { x: 1, y: 1, radius: 0 });
    spy.mockClear();
    spy.mockReturnValue({ x: 42, y: 43, radius: 0 });

    window.dispatchEvent(new Event("resize"));

    expect(spy).toHaveBeenCalledWith("need");
    const root = (mascot as any).root as HTMLElement;
    expect(root.style.left).toBe("22px"); // 42 - AVATAR_WIDTH / 2
    expect(root.style.top).toBe("55px"); // 43 + radius(0) + NODE_CLEARANCE(12)
  });

  it("stops tracking resizes after unmount", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition");
    const host = makeHost();
    const mascot = new Mascot(host, demo);
    mascot.mount();
    mascot.moveTo("need", { x: 1, y: 1 });
    mascot.unmount();
    spy.mockClear();

    window.dispatchEvent(new Event("resize"));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Mascot delegation to the composed Panel", () => {
  it("showInstrumentPanel renders the heading/stage inside the bubble", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();

    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    expect(host.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("User Need");
    expect(host.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Genesis?");
  });

  it("updateInstrumentPanel updates the live stage text", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    mascot.updateInstrumentPanel("Product");

    expect(host.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("Is it Product?");
  });

  it("confirmPlacement resolves once its link is clicked", async () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");

    const result = mascot.confirmPlacement("Let's think about it →");
    host.querySelector<HTMLAnchorElement>(".wd-next-link")!.click();

    await expect(result).resolves.toBeUndefined();
  });

  it("showQuestion renders options and resolves with the clicked one", async () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    const question: Question = {
      id: "q1",
      prompt: "How should you treat this?",
      options: [
        { id: "build", label: "Build it ourselves", annotation: "Build" },
        { id: "buy", label: "Buy a product", annotation: "Buy" },
      ],
    };

    const result = mascot.showQuestion("Capability", question);
    const buttons = host.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    buttons[1].click();

    expect(await result).toEqual(question.options[1]);
  });

  it("showRecap renders the CTA link", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();

    mascot.showRecap(["Step one"], { label: "Take your next step →", href: "https://learnwardleymapping.com" });

    const cta = host.querySelector<HTMLAnchorElement>(".wd-panel-recap-cta")!;
    expect(cta.href).toBe("https://learnwardleymapping.com/");
    expect(cta.textContent).toBe("Take your next step →");
  });

  it("showEmpty clears prior content down to an empty placeholder", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");

    mascot.showEmpty();

    const content = host.querySelector(".wd-panel-content")!;
    expect(content.children.length).toBe(0);
  });
});

describe("Mascot talking/celebrating state", () => {
  it("plays the talking state immediately when new bubble content renders", () => {
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();

    mascot.showPlaceholder("Wardley Map", "All placed!");

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--talking")).toBe(true);
  });

  it("settles back to idle after the talking animation finishes", () => {
    vi.useFakeTimers();
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");

    vi.advanceTimersByTime(700);

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--idle")).toBe(true);
    vi.useRealTimers();
  });

  it("does not stomp a caller-triggered celebrating state once the talking animation finishes", () => {
    vi.useFakeTimers();
    const host = makeHost();
    const mascot = new Mascot(host, buildDemo());
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");
    mascot.setState("celebrating");

    vi.advanceTimersByTime(700);

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--celebrating")).toBe(true);
    vi.useRealTimers();
  });
});
