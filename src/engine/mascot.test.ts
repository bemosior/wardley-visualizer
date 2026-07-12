import { afterEach, describe, expect, it, vi } from "vitest";
import { Mascot } from "./mascot";
import { WardleyDemo } from "./WardleyDemo";
import type { Question } from "../domain/questionBank";

function makeHosts(): { avatarHost: HTMLElement; dialogHost: HTMLElement } {
  const avatarHost = document.createElement("div");
  const dialogHost = document.createElement("div");
  document.body.append(avatarHost, dialogHost);
  return { avatarHost, dialogHost };
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
  it("appends the avatar into avatarHost and the dialog into dialogHost on mount", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);

    mascot.mount();

    expect(avatarHost.querySelector(".wd-mascot")).not.toBeNull();
    expect(avatarHost.querySelector(".wd-mascot-avatar")).not.toBeNull();
    expect(avatarHost.querySelector(".wd-mascot-caption")).not.toBeNull();
    expect(dialogHost.querySelector(".wd-mascot-dialog")).not.toBeNull();
  });

  it("removes both the avatar and the dialog on unmount", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.unmount();

    expect(avatarHost.querySelector(".wd-mascot")).toBeNull();
    expect(dialogHost.querySelector(".wd-mascot-dialog")).toBeNull();
  });
});

describe("Mascot first-position transition suppression", () => {
  it("spawns at its destination instantly (no left/top transition), then re-enables the transition for later moves", () => {
    const callbacks: FrameRequestCallback[] = [];
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      callbacks.push(cb);
      return callbacks.length;
    }) as typeof requestAnimationFrame;

    try {
      const { avatarHost, dialogHost } = makeHosts();
      const mascot = new Mascot(avatarHost, dialogHost);
      const avatarRoot = (mascot as any).avatarRoot as HTMLElement;

      mascot.moveTo("need", { x: 10, y: 20, radius: 50 });
      expect(avatarRoot.style.transition).toBe("none");

      callbacks.splice(0, callbacks.length).forEach((cb) => cb(0));
      expect(avatarRoot.style.transition).toBe("");

      mascot.moveTo("need", { x: 30, y: 40, radius: 50 });
      expect(avatarRoot.style.transition).toBe("");
    } finally {
      window.requestAnimationFrame = originalRaf;
    }
  });
});

describe("Mascot.moveTo", () => {
  it("plants the avatar below-and-centered on the given node, clear of its radius", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);

    mascot.moveTo("need", { x: 10, y: 20, radius: 50 });

    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;
    expect(avatarRoot.style.left).toBe("-10px"); // 10 - AVATAR_WIDTH / 2 (40 / 2)
    expect(avatarRoot.style.top).toBe("83px"); // 20 + radius(50) + NODE_CLEARANCE(12) + 1px self-clearance epsilon
  });

  it("re-tracks the last-moved node's position on window resize", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition").mockReturnValue({ x: 5, y: 6, radius: 0 });
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.attachDemo(demo);
    mascot.mount();
    mascot.moveTo("need", { x: 1, y: 1, radius: 0 });
    spy.mockClear();
    spy.mockReturnValue({ x: 42, y: 43, radius: 0 });

    window.dispatchEvent(new Event("resize"));

    expect(spy).toHaveBeenCalledWith("need");
    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;
    expect(avatarRoot.style.left).toBe("22px"); // 42 - AVATAR_WIDTH / 2
    expect(avatarRoot.style.top).toBe("56px"); // 43 + radius(0) + NODE_CLEARANCE(12) + 1px self-clearance epsilon
  });

  it("flips the avatar above the node when it doesn't fit below, based on its own fixed size", () => {
    const { avatarHost, dialogHost } = makeHosts();
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(avatarHost, dialogHost);
    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;

    mascot.moveTo("need", { x: 250, y: 270, radius: 20 });

    // below (270+20+12=302) plus the avatar's own 60px height would overflow a 300px-tall host;
    // above (270-20-12-1-60=177, the extra 1px a self-clearance epsilon) fits, so the avatar
    // should flip there instead.
    expect(avatarRoot.style.top).toBe("177px");
  });

  it("keeps the avatar below the node when it comfortably fits there", () => {
    const { avatarHost, dialogHost } = makeHosts();
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 500, height: 300 } as DOMRect);
    const mascot = new Mascot(avatarHost, dialogHost);
    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;

    mascot.moveTo("need", { x: 250, y: 200, radius: 20 });

    expect(avatarRoot.style.top).toBe("233px"); // 200 + radius(20) + NODE_CLEARANCE(12) + 1px self-clearance epsilon
  });

  it("never lets the avatar cross back above the page's own top edge", () => {
    const { avatarHost, dialogHost } = makeHosts();
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 500, height: 90, top: 20 } as DOMRect);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    const mascot = new Mascot(avatarHost, dialogHost);
    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;

    // below (50+20+12=82, +60=142) badly overflows a 90px-tall host; a naive "above" pick
    // (50-20-12-60=-42) would land 42px above the host's own origin, but the host itself only
    // sits 20px into the real page -- floored at the page's top edge instead of clipping past it.
    mascot.moveTo("need", { x: 250, y: 50, radius: 20 });

    expect(parseFloat(avatarRoot.style.top)).toBeGreaterThanOrEqual(-20);
  });

  it("stops tracking resizes after unmount", () => {
    const demo = buildDemo();
    const spy = vi.spyOn(demo, "getNodePixelPosition");
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.attachDemo(demo);
    mascot.mount();
    mascot.moveTo("need", { x: 1, y: 1 });
    mascot.unmount();
    spy.mockClear();

    window.dispatchEvent(new Event("resize"));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Mascot caption horizontal clamp", () => {
  it("leaves the caption at its default (right-of-avatar) position when there's room", () => {
    const { avatarHost, dialogHost } = makeHosts();
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 300, height: 300, left: 0, top: 0 } as DOMRect);
    const mascot = new Mascot(avatarHost, dialogHost);
    const captionEl = (mascot as any).captionEl as HTMLElement;
    vi.spyOn(captionEl, "getBoundingClientRect").mockReturnValue({ width: 100, height: 32 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 150 });

    expect(captionEl.classList.contains("wd-mascot-caption--flip")).toBe(false);
  });

  it("flips the caption to the avatar's left when there's no room on the right but there is on the left", () => {
    const { avatarHost, dialogHost } = makeHosts();
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 300, height: 300, left: 0, top: 0 } as DOMRect);
    const mascot = new Mascot(avatarHost, dialogHost);
    const captionEl = (mascot as any).captionEl as HTMLElement;
    vi.spyOn(captionEl, "getBoundingClientRect").mockReturnValue({ width: 150, height: 32 } as DOMRect);

    // anchored near the host's right edge -- a rightward caption would spill well past x=300
    mascot.moveTo("need", { x: 280, y: 150 });

    expect(captionEl.classList.contains("wd-mascot-caption--flip")).toBe(true);
  });

  it("still produces a finite, on-page placement when the caption can't fully fit on either side", () => {
    const { avatarHost, dialogHost } = makeHosts();
    // a host too narrow for the caption to fit anywhere without some overflow -- there's no
    // perfect answer here, but the search (see mascotPlacement.test.ts for the full scoring
    // rules) must still land on *something* usable rather than producing NaN/undefined styles.
    vi.spyOn(avatarHost, "getBoundingClientRect").mockReturnValue({ width: 100, height: 300, left: 0, top: 0 } as DOMRect);
    const mascot = new Mascot(avatarHost, dialogHost);
    const captionEl = (mascot as any).captionEl as HTMLElement;
    vi.spyOn(captionEl, "getBoundingClientRect").mockReturnValue({ width: 200, height: 32 } as DOMRect);

    mascot.moveTo("need", { x: 50, y: 150 });

    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;
    expect(Number.isFinite(parseFloat(avatarRoot.style.left))).toBe(true);
    expect(Number.isFinite(parseFloat(avatarRoot.style.top))).toBe(true);
  });
});

describe("Mascot obstacle avoidance (via attached demo)", () => {
  it("steers the avatar clear of a sibling node instead of just the anchor", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "need", label: "Need", x: 200, y: 100, draggable: false },
        // sits right where the default "below" placement would otherwise land
        { id: "capability", label: "Capability", x: 200, y: 220, draggable: false },
      ],
      connections: [],
      snapThreshold: 30,
    });
    vi.spyOn(demo, "getNodePixelPosition").mockImplementation((id: string) =>
      id === "need" ? { x: 200, y: 100, radius: 40 } : { x: 200, y: 220, radius: 40 },
    );
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.attachDemo(demo);

    mascot.moveTo("need", { x: 200, y: 100, radius: 40 });

    const avatarRoot = (mascot as any).avatarRoot as HTMLElement;
    const top = parseFloat(avatarRoot.style.top);
    // below (100 + 40 + 12 = 152) would run straight into the Capability node's circle
    // (top 220 - radius 40 = 180); the mascot must have picked a different direction instead
    expect(top === 152).toBe(false);
  });
});

describe("Mascot.say", () => {
  it("sets the caption text and plays the talking animation", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.say("This is a Need.");

    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("This is a Need.");
    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--talking")).toBe(true);
  });

  it("warns when the caption text exceeds the char guard, but still renders it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.say("a".repeat(90));

    expect(warn).toHaveBeenCalledOnce();
    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("a".repeat(90));
    warn.mockRestore();
  });

  it("does not warn for text within the char guard", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.say("Short and sweet.");

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("Mascot.confirmPlacement", () => {
  it("appends a compact confirm control to the caption when it was the last surface used", async () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.say("This is a Need.");

    const result = mascot.confirmPlacement("Next");
    const button = avatarHost.querySelector<HTMLButtonElement>(".wd-next-link")!;
    expect(button.classList.contains("wd-next-link--compact")).toBe(true);
    button.click();

    await expect(result).resolves.toBeUndefined();
  });

  it("appends a confirm control to the dialog panel when it was the last surface used", async () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.showEmpty();

    const result = mascot.confirmPlacement("Let's think about it →");
    dialogHost.querySelector<HTMLButtonElement>(".wd-next-link")!.click();

    await expect(result).resolves.toBeUndefined();
  });
});

describe("Mascot delegation to the composed Panel", () => {
  it("panel-hosted methods render into the dialog host and point the caption at it", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    const handle = mascot.showDragHandles([{ id: "need", iconText: "User Need", label: "What They Get", active: true }], {
      heading: "Hi, I'm here to help!",
      subheading: "Drag the glowing circle onto the canvas to begin.",
    });

    expect(dialogHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Hi, I'm here to help!");
    expect(dialogHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe(
      "Drag the glowing circle onto the canvas to begin.",
    );
    const active = dialogHost.querySelector(".wd-panel-slot--active");
    expect(active).not.toBeNull();
    expect(handle.activeElement).toBe(active);
    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("Take a look below. ↓");
  });

  it("showField renders the prompt and resolves with the submitted value", async () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    const result = mascot.showField({ type: "text", prompt: "Who needs this?", placeholder: "e.g. commuters" });

    expect(dialogHost.querySelector(".wd-panel-form-prompt")!.textContent).toBe("Who needs this?");
    const input = dialogHost.querySelector<HTMLInputElement>(".wd-panel-form-input")!;
    input.value = "Busy parents";
    dialogHost.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(await result).toBe("Busy parents");
  });

  it("showInstrumentPanel renders the heading/stage inside the dialog panel", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    expect(dialogHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is User Need in Genesis?");
    expect(dialogHost.querySelector(".wd-panel-instrument-characteristics")!.textContent).not.toBe("");
  });

  it("updateInstrumentPanel updates the live stage text", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.showInstrumentPanel("User Need", "need", "Genesis");

    mascot.updateInstrumentPanel("Product");

    expect(dialogHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Is User Need in Product?");
  });

  it("showQuestion renders options and resolves with the clicked one", async () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
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
    const buttons = dialogHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    buttons[1].click();

    expect(await result).toEqual(question.options[1]);
  });

  it("showGate renders the prompt/subtitle/options and resolves with the clicked option's id", async () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    const result = mascot.showGate("Could exploring bias with A kettle teach us something?", "Keep going!", [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ]);
    const buttons = dialogHost.querySelectorAll<HTMLButtonElement>(".wd-panel-question-option");
    buttons[0].click();

    expect(await result).toBe("yes");
  });

  it("showRecap renders the CTA link", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.showRecap(["Step one"], { label: "Take your next step →", href: "https://learnwardleymapping.com" });

    const cta = dialogHost.querySelector<HTMLAnchorElement>(".wd-panel-recap-cta")!;
    expect(cta.href).toBe("https://learnwardleymapping.com/");
    expect(cta.textContent).toBe("Take your next step →");
  });

  it("showEmpty clears prior content down to an empty placeholder", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.showRecap(["Step one"], { label: "Next", href: "https://example.com" });

    mascot.showEmpty();

    const content = dialogHost.querySelector(".wd-panel-content")!;
    expect(content.children.length).toBe(0);
  });

  it("showPlaceholder renders the heading/subheading inside the dialog panel", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.showPlaceholder("Wardley Map", "All placed!");

    expect(dialogHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Wardley Map");
    expect(dialogHost.querySelector(".wd-panel-placeholder-subheading")!.textContent).toBe("All placed!");
  });
});

describe("Mascot talking/celebrating state", () => {
  it("plays the talking state immediately when new caption content renders", () => {
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    mascot.say("Wardley Map, all placed!");

    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--talking")).toBe(true);
  });

  it("settles back to idle after the talking animation finishes", () => {
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.say("Wardley Map, all placed!");

    vi.advanceTimersByTime(700);

    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--idle")).toBe(true);
    vi.useRealTimers();
  });

  it("does not stomp a caller-triggered celebrating state once the talking animation finishes", () => {
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    mascot.say("Wardley Map, all placed!");
    mascot.setState("celebrating");

    vi.advanceTimersByTime(700);

    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--celebrating")).toBe(true);
    vi.useRealTimers();
  });
});

describe("Mascot.arrive", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("plays a pop-in + celebrate flourish, then settles back to idle", async () => {
    // src/test/setup.ts shims matchMedia to always report reduced motion -- disable that here to
    // exercise arrive()'s real animated path.
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    const arrived = mascot.arrive();

    expect(avatarHost.querySelector(".wd-mascot")!.classList.contains("wd-mascot--arriving")).toBe(true);
    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--celebrating")).toBe(true);

    await vi.advanceTimersByTimeAsync(1100);
    await arrived;

    expect(avatarHost.querySelector(".wd-mascot")!.classList.contains("wd-mascot--arriving")).toBe(false);
    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--idle")).toBe(true);
    vi.useRealTimers();
  });

  it("spawns a firework burst at the avatar's landing position once it's been positioned", async () => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();
    const demo = buildDemo();
    mascot.attachDemo(demo);
    const pos = demo.getNodePixelPosition("need")!;
    mascot.moveTo("need", pos);

    const arrived = mascot.arrive();

    expect(avatarHost.querySelectorAll(".wd-firework-shell").length).toBe(0);

    await vi.advanceTimersByTimeAsync(300);
    expect(avatarHost.querySelectorAll(".wd-firework-shell").length).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(1700);
    await arrived;

    expect(avatarHost.querySelectorAll(".wd-firework-shell").length).toBe(0);
    vi.useRealTimers();
  });

  it("does not spawn a firework burst when arrive() is called without a prior moveTo", async () => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    const arrived = mascot.arrive();
    await vi.advanceTimersByTimeAsync(1100);
    await arrived;

    expect(avatarHost.querySelectorAll(".wd-firework-shell").length).toBe(0);
    vi.useRealTimers();
  });

  it("skips the flourish and delay under prefers-reduced-motion", async () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    await mascot.arrive();

    expect(avatarHost.querySelector(".wd-mascot")!.classList.contains("wd-mascot--arriving")).toBe(false);
    expect(avatarHost.querySelector(".wd-mascot-avatar")!.classList.contains("wd-mascot--idle")).toBe(true);
  });

  it("keeps the caption and dialog empty and hidden until reveal fires, right before they're unhidden", async () => {
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    let revealedWhileHidden = false;
    const arrived = mascot.arrive(() => {
      revealedWhileHidden = avatarHost.querySelector(".wd-mascot")!.classList.contains("wd-mascot--arriving");
      mascot.say("Want to build a Wardley Map?");
    });

    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("");

    await vi.advanceTimersByTimeAsync(1100);
    await arrived;

    expect(revealedWhileHidden).toBe(true);
    expect(avatarHost.querySelector(".wd-mascot")!.classList.contains("wd-mascot--arriving")).toBe(false);
    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("Want to build a Wardley Map?");
    vi.useRealTimers();
  });

  it("invokes reveal immediately under prefers-reduced-motion, before returning", async () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    await mascot.arrive(() => mascot.say("Want to build a Wardley Map?"));

    expect(avatarHost.querySelector(".wd-mascot-caption-text")!.textContent).toBe("Want to build a Wardley Map?");
  });

  it("also hides the dialog panel until reveal fires, when the caller reveals dialog content instead", async () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const { avatarHost, dialogHost } = makeHosts();
    const mascot = new Mascot(avatarHost, dialogHost);
    mascot.mount();

    await mascot.arrive(() => mascot.showPlaceholder("Want to build a Wardley Map?", ""));

    expect(dialogHost.querySelector(".wd-mascot-dialog")!.classList.contains("wd-mascot-dialog--arriving")).toBe(false);
    expect(dialogHost.querySelector(".wd-panel-placeholder-heading")!.textContent).toBe("Want to build a Wardley Map?");
  });
});
