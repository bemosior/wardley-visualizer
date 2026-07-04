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

  it("leaves the bubble at its default (right-of-avatar) position when there's room", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 100 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 20 });

    expect(bubble.style.left).toBe("0px");
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(false);
  });

  it("flips the bubble to the avatar's left when there's no room on the right", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200 } as DOMRect);

    // avatarLeft = 280 - 20 = 260; natural right-side placement (260+40+8=308, +200=508) overflows
    // a 300px-wide host, but the left side (260-8-200=52) fits, so it should flip there.
    mascot.moveTo("need", { x: 280, y: 20 });

    expect(bubble.style.left).toBe("-256px");
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(true);
  });

  it("clamps the bubble inside the host as a last resort when neither side fully fits", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 100 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 150 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 20 });

    const root = (mascot as any).root as HTMLElement;
    const avatarLeft = parseFloat(root.style.left);
    const bubbleOffset = parseFloat(bubble.style.left);
    // the bubble's right edge should land exactly on the host's right edge, even though it can't
    // fit inside the host at all (150px bubble, 100px host) — best effort, not a perfect fit
    expect(avatarLeft + 40 + 8 + bubbleOffset + 150).toBe(100);
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(false);
  });

  it("flips the mascot above the node when the bubble is too tall to fit below", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 150 } as DOMRect);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });

    // below (200+20+12=232) plus a 150px-tall row would overflow a 300px-tall host; above
    // (200-20-12-150=18) fits, so it should flip there instead.
    expect(root.style.top).toBe("18px");
  });

  it("keeps the default below position when the bubble is short enough to fit", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 40 } as DOMRect);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });

    expect(root.style.top).toBe("232px");
  });

  it("clamps fully inside the canvas when the content fits the host but not either clear zone", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 150 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 120 } as DOMRect);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 100, radius: 20 });

    // below (100+20+12=132, +120 tall row = 252) overflows a 150px host by 102px; above
    // (100-20-12-120=-52) overflows the top by only 52px, so it wins the pick -- but since the
    // 120px-tall row still fits inside a 150px host on its own, it gets clamped fully inside
    // (to 0) instead of being left hanging 52px above the canvas.
    expect(root.style.top).toBe("0px");
  });

  it("re-clamps vertically when a later content change makes the bubble taller", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    const rootRect = vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ height: 40 } as DOMRect);
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });
    expect(root.style.top).toBe("232px"); // fits fine while the bubble is short

    rootRect.mockReturnValue({ height: 150 } as DOMRect); // e.g. showQuestion renders taller content
    mascot.showPlaceholder("Wardley Map", "All placed!");

    expect(root.style.top).toBe("18px"); // no longer fits below -- flips above, same as moveTo would
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
