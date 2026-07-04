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

  it("flips the avatar above the node when it doesn't fit below, based on its own fixed size", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;

    mascot.moveTo("need", { x: 250, y: 270, radius: 20 });

    // below (270+20+12=302) plus the avatar's own 60px height would overflow a 300px-tall host;
    // above (270-20-12-60=178) fits, so the avatar should flip there instead.
    expect(root.style.top).toBe("178px");
  });

  it("keeps the avatar and bubble together, below the node, when the bubble comfortably fits there", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80, height: 68 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });

    expect(root.style.top).toBe("232px");
    expect(bubble.style.top).toBe("0px"); // same row as the avatar -- no independent shift needed
  });

  it("moves the avatar and bubble above the node together when the bubble is too tall to fit below", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80, height: 250 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });

    // below (232 + 250 = 482) would badly overflow a 300px host; above fits the 250px bubble
    // (200 - 20 - 12 - 250 = -82, only 82px short of the top) far better, so *both* the avatar and
    // the bubble move there together, each flush against the node's clearance line (168) from
    // above -- the avatar's bottom edge at 168, the taller bubble's bottom edge also at 168.
    expect(root.style.top).toBe("108px"); // 168 - AVATAR_HEIGHT(60)
    expect(bubble.style.top).toBe("-190px"); // bubble top -82, minus avatar top 108
    // the tail tracks the avatar's real center (108 + 30 = 138) relative to the bubble's new top (-82)
    expect(bubble.style.getPropertyValue("--wd-tail-top")).toBe("220px");
  });

  it("never lets the bubble cross back toward the node, even if that leaves it overflowing the canvas", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 150 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80, height: 200 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 50, radius: 0 });

    // a 200px-tall bubble can never fit a 150px host either above or below, so "below" wins as the
    // lesser overflow -- but rather than shrinking the gap to the node to compensate (the old,
    // buggy behavior), the avatar and bubble both plant flush on the node's clearance line (62)
    // and simply run past the host's bottom edge instead, since that's the harmless direction.
    expect(root.style.top).toBe("62px");
    expect(bubble.style.top).toBe("0px");
  });

  it("moves the avatar along with the bubble when a later content change forces a side flip", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host, buildDemo());
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    const bubbleRect = vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 80, height: 40 } as DOMRect);

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });
    expect(root.style.top).toBe("232px");
    expect(bubble.style.top).toBe("0px"); // fits fine below while the bubble is short

    bubbleRect.mockReturnValue({ width: 80, height: 150 } as DOMRect); // e.g. showQuestion renders taller content
    mascot.showPlaceholder("Wardley Map", "All placed!");

    // the taller bubble no longer fits below, so the whole group -- avatar included -- flips
    // above the node together, rather than the bubble alone drifting back toward it.
    expect(root.style.top).toBe("108px");
    expect(bubble.style.top).toBe("-90px");
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
