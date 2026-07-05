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
    const mascot = new Mascot(host);

    mascot.mount();

    expect(host.querySelector(".wd-mascot")).not.toBeNull();
    expect(host.querySelector(".wd-mascot-avatar")).not.toBeNull();
    expect(host.querySelector(".wd-mascot-bubble")).not.toBeNull();
  });

  it("removes the mascot root on unmount", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    mascot.unmount();

    expect(host.querySelector(".wd-mascot")).toBeNull();
  });
});

describe("Mascot.moveTo", () => {
  it("plants the root below-and-centered on the given node, clear of its radius", () => {
    const mascot = new Mascot(makeHost());

    mascot.moveTo("need", { x: 10, y: 20, radius: 50 });

    const root = (mascot as any).root as HTMLElement;
    expect(root.style.left).toBe("-10px"); // 10 - AVATAR_WIDTH / 2 (40 / 2)
    expect(root.style.top).toBe("82px"); // 20 + radius(50) + NODE_CLEARANCE(12)
  });

  it("re-tracks the last-moved node's position on window resize", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition").mockReturnValue({ x: 5, y: 6, radius: 0 });
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.attachDemo(demo);
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
    const mascot = new Mascot(host);
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 100 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 20 });

    expect(bubble.style.left).toBe("0px");
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(false);
  });

  it("flips the bubble to the avatar's left when there's no room on the right", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 300 } as DOMRect);
    const mascot = new Mascot(host);
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200 } as DOMRect);

    // avatarLeft = 280 - 20 = 260; natural right-side placement (260+40+8=308, +200=508) overflows
    // a 300px-wide host, but the left side (260-8-200=52) fits, so it should flip there.
    mascot.moveTo("need", { x: 280, y: 20 });

    expect(bubble.style.left).toBe("-256px");
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(true);
  });

  it("lets the bubble overflow the host rather than sliding it back over the avatar when neither side fully fits", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 100 } as DOMRect);
    const mascot = new Mascot(host);
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 150 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 20 });

    const root = (mascot as any).root as HTMLElement;
    const avatarLeft = parseFloat(root.style.left);
    const bubbleOffset = parseFloat(bubble.style.left);
    // the bubble's near edge stays exactly at its clearance line from the avatar (unmoved from
    // the unclamped right-side placement) even though its far edge now overflows the 100px-wide
    // host by 128px (150px bubble, only 78px of clearance-respecting room) — spilling past the
    // canvas edge is preferable to sliding the bubble back over the avatar it's meant to clear
    expect(bubbleOffset).toBe(0);
    expect(avatarLeft + 40 + 8 + bubbleOffset + 150).toBe(228);
    expect(bubble.classList.contains("wd-mascot-bubble--flip")).toBe(false);
  });

  it("flips the avatar above the node when it doesn't fit below, based on its own fixed size", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host);
    const root = (mascot as any).root as HTMLElement;

    mascot.moveTo("need", { x: 250, y: 270, radius: 20 });

    // below (270+20+12=302) plus the avatar's own 60px height would overflow a 300px-tall host;
    // above (270-20-12-60=178) fits, so the avatar should flip there instead.
    expect(root.style.top).toBe("178px");
  });

  it("keeps the avatar and bubble together, below the node, when the bubble comfortably fits there", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(host);
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
    const mascot = new Mascot(host);
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
    const mascot = new Mascot(host);
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
    const mascot = new Mascot(host);
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

  it("lets a northeast-shifted bubble settle below the shifted anchor when that's where the real room is", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 500 } as DOMRect);
    const mascot = new Mascot(host);
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200, height: 130 } as DOMRect);

    // "northeast" only shifts the anchor up-and-right before the normal, measured below/above pick
    // runs -- it doesn't force a side. The shifted anchor (180, 120) has plenty of room to grow
    // "below" within a 500px-tall host, so that's where it settles; static re-anchors like this one
    // (a mascot beat beside a node that isn't about to be dragged) don't need a harder guarantee
    // than "wherever there's real room" -- see `"pinned"` below for the one placement that does.
    mascot.moveTo("need", { x: 100, y: 200, radius: 48 }, "northeast");

    expect(root.style.top).toBe("132px"); // clearBelow: shifted y(120) + NODE_CLEARANCE(12)
  });

  it("forces a pinned bubble above the node when there's real, unclipped room for it", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 500 } as DOMRect);
    const mascot = new Mascot(host);
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200, height: 130 } as DOMRect);

    // same anchor as the "northeast" test above, where letting the normal pick run would settle
    // "below" the shifted anchor -- fine for a static re-anchor, but wrong for a node about to drag
    // freely along its own row (Phase 20's evolution axis) with the mascot not chasing it: growing
    // "below" the shifted anchor still reaches back down into the node's own row, which the node's
    // horizontal drag would then pass right back underneath. "pinned" forces "above" instead, since
    // there's real room for it here (no real `top` mocked, so the page-edge check no-ops and can't
    // veto it).
    mascot.moveTo("need", { x: 100, y: 200, radius: 48 }, "pinned");

    expect(root.style.top).toBe("48px"); // clearAbove(108) - AVATAR_HEIGHT(60)
    const bubbleBottom = parseFloat(bubble.style.top) + parseFloat(root.style.top) + 130;
    expect(bubbleBottom).toBeLessThanOrEqual(152); // clear of the node's own top edge
  });

  it("falls back off a pinned node with no room above it instead of pushing the mascot off-screen", () => {
    const host = makeHost();
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 500 } as DOMRect);
    const mascot = new Mascot(host);
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200, height: 130 } as DOMRect);

    // the value chain's User node is rendered tangent to the canvas's own top edge (y = -radius),
    // so a northeast shift (up and to the right) has no real room to move into -- `northeastPoint`
    // reports this as `clamped`, which skips "pinned"'s force-above attempt entirely (there's
    // nothing to verify room for) and falls through to the same measured pick every other
    // placement uses, landing "below" (a mostly-horizontal shift) instead of off-screen.
    mascot.moveTo("user", { x: 200, y: -20, radius: 20 }, "pinned");

    expect(parseFloat(root.style.top)).toBeGreaterThanOrEqual(0);
    const bubbleTop = parseFloat(bubble.style.top) + parseFloat(root.style.top);
    expect(bubbleTop).toBeGreaterThanOrEqual(0);
  });

  it("falls back to the out-of-the-way corner when a pinned node has some room above it but not enough to be a hard guarantee", () => {
    const host = makeHost();
    // the host sits only 20px into the real document (e.g. a host page with little headroom above
    // its canvas) -- mocking a real `top` (unlike most tests here) is what turns on the page-aware
    // room check at all.
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({ width: 500, height: 500, top: 20 } as DOMRect);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    const mascot = new Mascot(host);
    const root = (mascot as any).root as HTMLElement;
    const bubble = (mascot as any).bubbleEl as HTMLElement;
    vi.spyOn(bubble, "getBoundingClientRect").mockReturnValue({ width: 200, height: 130 } as DOMRect);

    // node at y=100, radius=48 has *some* room above it (unlike the tangent User node above), so
    // `northeastPoint` isn't `clamped` -- but forcing "above" here would still land the group 122px
    // short of fitting before the real document's top edge (only 8px of local clearance against a
    // 130px group). Rather than clip it against the page edge (the old, buggy behavior), "pinned"
    // recognizes there's no *real* guarantee available and anchors to the same corner
    // `moveToTopRight` uses instead -- clear of every row, node-drag hazard or not.
    mascot.moveTo("need", { x: 200, y: 100, radius: 48 }, "pinned");

    expect(root.style.left).toBe("416px"); // topRightPoint: (500 - CORNER_MARGIN(64)) - AVATAR_WIDTH/2(20)
    expect(root.style.top).toBe("26px"); // topRightPoint's y(CORNER_MARGIN_TOP=14) + NODE_CLEARANCE(12): plenty of room below it
  });

  it("stops tracking resizes after unmount", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition");
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.attachDemo(demo);
    mascot.mount();
    mascot.moveTo("need", { x: 1, y: 1 });
    mascot.unmount();
    spy.mockClear();

    window.dispatchEvent(new Event("resize"));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Mascot delegation to the composed Panel", () => {
  it("showDragHandles renders the intro heading/subheading and the active slot", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    const handle = mascot.showDragHandles([{ id: "need", iconText: "User Need", label: "What They Get", active: true }], {
      heading: "Hi, I'm here to help!",
      subheading: "Drag the glowing circle onto the canvas to begin.",
    });

    expect(host.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Hi, I'm here to help!");
    expect(host.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "Drag the glowing circle onto the canvas to begin.",
    );
    const active = host.querySelector(".wd-panel-slot--active");
    expect(active).not.toBeNull();
    expect(handle.activeElement).toBe(active);
  });

  it("showField renders the prompt and resolves with the submitted value", async () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    const result = mascot.showField({ type: "text", prompt: "Who needs this?", placeholder: "e.g. commuters" });

    expect(host.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who needs this?");
    const input = host.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
    input.value = "Busy parents";
    host.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(await result).toBe("Busy parents");
  });

  it("showInstrumentPanel renders the heading/stage inside the bubble", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    expect(host.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is User Need in Genesis?");
    expect(host.querySelector(".wd-panel-instrument-characteristics")!.textContent).not.toBe("");
  });

  it("updateInstrumentPanel updates the live stage text", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();
    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    mascot.updateInstrumentPanel("Product");

    expect(host.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is User Need in Product?");
  });

  it("confirmPlacement resolves once its link is clicked", async () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");

    const result = mascot.confirmPlacement("Let's think about it →");
    host.querySelector<HTMLButtonElement>(".wd-next-link")!.click();

    await expect(result).resolves.toBeUndefined();
  });

  it("showQuestion renders options and resolves with the clicked one", async () => {
    const host = makeHost();
    const mascot = new Mascot(host);
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

  it("showGate renders the prompt/subtitle/options and resolves with the clicked option's id", async () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    const result = mascot.showGate("Could exploring bias with A kettle teach us something?", "Keep going!", [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ]);
    const buttons = host.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    buttons[0].click();

    expect(await result).toBe("yes");
  });

  it("showRecap renders the CTA link", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();

    mascot.showRecap(["Step one"], { label: "Take your next step →", href: "https://learnwardleymapping.com" });

    const cta = host.querySelector<HTMLAnchorElement>(".wd-panel-recap-cta")!;
    expect(cta.href).toBe("https://learnwardleymapping.com/");
    expect(cta.textContent).toBe("Take your next step →");
  });

  it("showEmpty clears prior content down to an empty placeholder", () => {
    const host = makeHost();
    const mascot = new Mascot(host);
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
    const mascot = new Mascot(host);
    mascot.mount();

    mascot.showPlaceholder("Wardley Map", "All placed!");

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--talking")).toBe(true);
  });

  it("settles back to idle after the talking animation finishes", () => {
    vi.useFakeTimers();
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");

    vi.advanceTimersByTime(700);

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--idle")).toBe(true);
    vi.useRealTimers();
  });

  it("does not stomp a caller-triggered celebrating state once the talking animation finishes", () => {
    vi.useFakeTimers();
    const host = makeHost();
    const mascot = new Mascot(host);
    mascot.mount();
    mascot.showPlaceholder("Wardley Map", "All placed!");
    mascot.setState("celebrating");

    vi.advanceTimersByTime(700);

    expect(host.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--celebrating")).toBe(true);
    vi.useRealTimers();
  });
});
