import { describe, expect, it, vi } from "vitest";
import { WardleyDemo } from "./WardleyDemo";
import type { DemoConfig, DemoNode } from "./types";

function mountEmpty(): WardleyDemo {
  return WardleyDemo.mount(document.createElement("div"), {
    viewBox: { width: 400, height: 300 },
    nodes: [],
    connections: [],
    snapThreshold: 30,
  });
}

function drag(nodeGroup: Element, to: { x: number; y: number }): void {
  nodeGroup.dispatchEvent(new PointerEvent("pointerdown", { clientX: 20, clientY: 150, pointerId: 1 }));
  nodeGroup.dispatchEvent(new PointerEvent("pointermove", { clientX: to.x, clientY: to.y, pointerId: 1 }));
  nodeGroup.dispatchEvent(new PointerEvent("pointerup", { clientX: to.x, clientY: to.y, pointerId: 1 }));
}

describe("WardleyDemo.addNode", () => {
  it("places a draggable node at its start position, not its target", () => {
    const demo = mountEmpty();
    const group = demo.addNode({ id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } });
    expect(group.getAttribute("transform")).toBe("translate(20, 150)");
  });

  it("places a non-draggable node at its target position", () => {
    const demo = mountEmpty();
    const group = demo.addNode({ id: "user", label: "User", x: 200, y: 50, draggable: false });
    expect(group.getAttribute("transform")).toBe("translate(200, 50)");
  });
});

describe("WardleyDemo.addConnection", () => {
  it("throws if an endpoint hasn't been registered via addNode yet", () => {
    const demo = mountEmpty();
    demo.addNode({ id: "user", label: "User", x: 200, y: 50, draggable: false });
    expect(() => demo.addConnection({ from: "user", to: "need" })).toThrow();
  });

  it("draws a line between each node's start (if draggable) or target position", () => {
    const demo = mountEmpty();
    demo.addNode({ id: "user", label: "User", x: 200, y: 50, draggable: false });
    demo.addNode({ id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } });
    const line = demo.addConnection({ from: "user", to: "need" });

    expect(line.getAttribute("x1")).toBe("200");
    expect(line.getAttribute("y1")).toBe("50");
    expect(line.getAttribute("x2")).toBe("20");
    expect(line.getAttribute("y2")).toBe("150");
  });
});

describe("WardleyDemo.showMapBackdrop", () => {
  it("appends the backdrop into the layer that is the SVG's first child, behind everything else", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });

    demo.showMapBackdrop(demo.captureScale());

    const svg = container.querySelector("svg")!;
    const backdropLayer = svg.firstElementChild!;
    expect(backdropLayer.querySelector(".wd-backdrop")).not.toBeNull();
  });

  it("widens the viewBox to fill the container's new width without changing the passed-in scale", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 800, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }),
    });
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });

    // simulates the scale captured while the container was still 400px wide (scale 1), before a
    // host-side resize doubled it to 800px — showMapBackdrop must widen the viewBox to 800 to
    // keep that same scale, not leave it at the old 400.
    demo.showMapBackdrop(1);

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 800 300");
  });

  it("extends the viewBox height downward to reach targetHeightPx at the same scale, without changing it", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 400, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }),
    });
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });

    // scale 1, target height 600 -> viewBox height must grow to 600 (600 / 1), not shrink or
    // change the scale; the existing node at y:50 must stay exactly where it is.
    demo.showMapBackdrop(1, 600);

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 400 600");
  });

  it("never shrinks the viewBox height below its current value, even if targetHeightPx implies a smaller one", () => {
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 400, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }),
    });
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });

    demo.showMapBackdrop(1, 100);

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 400 300");
  });

  it("with captionText, shows a caption centered on the newly revealed area that fades in then out and is removed", () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ width: 800, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }),
    });
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [],
      connections: [],
      snapThreshold: 30,
    });

    // scale 1: viewBox widens from 400 to 800 -> the newly revealed strip is 400..800, so the
    // caption should center at x=600, not over the original 0..400 area where nodes already sit.
    demo.showMapBackdrop(1, undefined, "Let's turn it into a Wardley Map!");

    const caption = container.querySelector(".wd-map-caption")!;
    expect(caption.textContent).toBe("Let's turn it into a Wardley Map!");
    expect(caption.getAttribute("x")).toBe("600");
    expect(caption.classList.contains("wd-map-caption--visible")).toBe(false);

    // advance only past the 0ms fade-in timer, not the later 5200ms fade-out one (which
    // `runOnlyPendingTimers` would also fire here, since both are already pending).
    vi.advanceTimersByTime(0);
    expect(caption.classList.contains("wd-map-caption--visible")).toBe(true);

    vi.advanceTimersByTime(5200);
    expect(caption.classList.contains("wd-map-caption--visible")).toBe(false);
    expect(container.querySelector(".wd-map-caption")).not.toBeNull();

    vi.advanceTimersByTime(600);
    expect(container.querySelector(".wd-map-caption")).toBeNull();

    vi.useRealTimers();
  });
});

describe("WardleyDemo.relabelNode", () => {
  it("updates a node's label text", () => {
    const demo = mountEmpty();
    const group = demo.addNode({ id: "need", label: "Need", x: 200, y: 150, draggable: false });
    const labelEl = group.querySelector<SVGTextElement>(".wd-node-label")!;

    demo.relabelNode("need", "Hi");

    expect(labelEl.textContent).toBe("Hi");
  });

  it("resets any previous font-size override before refitting (happy-dom has no real text layout, so simulate the prior shrink directly rather than relying on measured width)", () => {
    const demo = mountEmpty();
    const group = demo.addNode({ id: "need", label: "Need", x: 200, y: 150, draggable: false });
    const labelEl = group.querySelector<SVGTextElement>(".wd-node-label")!;
    labelEl.style.fontSize = "20px";

    demo.relabelNode("need", "Hi");

    expect(labelEl.style.fontSize).toBe("");
  });

  it("does nothing if the node id isn't registered", () => {
    const demo = mountEmpty();
    expect(() => demo.relabelNode("missing", "Hi")).not.toThrow();
  });
});

describe("WardleyDemo.stopCharging", () => {
  it("removes the charged glow from the given nodes without affecting others or the active lines", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });
    demo.skipDrag();
    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(true);
    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(true);

    demo.stopCharging(["user", "need"]);

    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(container.querySelector(".wd-line")!.classList.contains("wd-line--active")).toBe(true);
  });

  it("does nothing if a node id isn't registered", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });
    expect(() => demo.stopCharging(["missing"])).not.toThrow();
  });
});

describe("WardleyDemo.beckonNode", () => {
  it("adds the beckon pulse to the given node, leaving others untouched", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: false },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });

    demo.beckonNode("need");

    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--beckon")).toBe(true);
    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--beckon")).toBe(false);
  });

  it("clears any pending dimming from the node, since its turn has arrived", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "need", label: "Need", x: 200, y: 150, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });
    demo.markPending(["need"]);

    demo.beckonNode("need");

    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--pending")).toBe(false);
  });

  it("does nothing if the node id isn't registered", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });
    expect(() => demo.beckonNode("missing")).not.toThrow();
  });
});

describe("WardleyDemo.markPending", () => {
  it("dims the given nodes, leaving others untouched", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: false },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });

    demo.markPending(["need"]);

    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--pending")).toBe(true);
    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--pending")).toBe(false);
  });

  it("does nothing if a node id isn't registered", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [{ id: "user", label: "User", x: 200, y: 50, draggable: false }],
      connections: [],
      snapThreshold: 30,
    });
    expect(() => demo.markPending(["missing"])).not.toThrow();
  });
});

describe("WardleyDemo.slideToGenesis", () => {
  function buildDemo(): { demo: WardleyDemo; container: HTMLElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });
    return { demo, container };
  }

  it("moves the node and its connected line endpoint to the Genesis column's center x, keeping y", () => {
    const { demo, container } = buildDemo();

    demo.slideToGenesis("need");

    expect(container.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toBe("translate(50, 150)");
    expect(container.querySelector(".wd-line")!.getAttribute("x2")).toBe("50");
    expect(container.querySelector(".wd-line")!.getAttribute("y2")).toBe("150");
  });

  it("respawns flow particles touching the moved node riding the line's new position", () => {
    const { demo, container } = buildDemo();
    demo.skipDrag();
    expect(container.querySelectorAll(".wd-flow-particle").length).toBeGreaterThan(0);

    demo.slideToGenesis("need");

    const particles = container.querySelectorAll<SVGCircleElement>(".wd-flow-particle");
    expect(particles.length).toBeGreaterThan(0);
    particles.forEach((particle) => {
      // Genesis curves the path (and sometimes overshoots the target), so this only pins the
      // line's start (unmoved "user" endpoint) and that it now targets the new position somehow —
      // not a literal "L 50,150" straight segment, which curved/miss paths won't always contain.
      expect(particle.style.offsetPath.startsWith('path("M 200,50 ')).toBe(true);
      expect(particle.style.offsetPath).toContain(" Q ");
    });
  });

  it("does nothing if the node id isn't registered", () => {
    const { demo } = buildDemo();
    expect(() => demo.slideToGenesis("missing")).not.toThrow();
  });

  it("calls onComplete exactly once, after the move settles", () => {
    const { demo } = buildDemo();
    const onComplete = vi.fn();

    demo.slideToGenesis("need", 0, onComplete);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("doesn't call onComplete if the node id isn't registered", () => {
    const { demo } = buildDemo();
    const onComplete = vi.fn();

    demo.slideToGenesis("missing", 0, onComplete);

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("is a safe no-op to omit onComplete", () => {
    const { demo } = buildDemo();
    expect(() => demo.slideToGenesis("need", 0)).not.toThrow();
  });
});

describe("WardleyDemo.getNodePixelPosition", () => {
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

  it("returns null for an unregistered node id", () => {
    const demo = buildDemo();
    expect(demo.getNodePixelPosition("missing")).toBeNull();
  });

  it("returns a container-pixel position and on-screen radius for a registered node", () => {
    const demo = buildDemo();
    const pos = demo.getNodePixelPosition("need");
    expect(pos).not.toBeNull();
    expect(pos).toEqual({ x: expect.any(Number), y: expect.any(Number), radius: expect.any(Number) });
  });
});

describe("WardleyDemo.celebrateAll", () => {
  function buildDemo(): { demo: WardleyDemo; container: HTMLElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: false },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });
    return { demo, container };
  }

  it("activates every line and fires one firework per node, without charging nodes that weren't already charged", () => {
    vi.useFakeTimers();
    const { demo, container } = buildDemo();
    demo.celebrateAll();

    expect(container.querySelector(".wd-line")!.classList.contains("wd-line--active")).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(container.querySelectorAll(".wd-firework-shell").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(false);
    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(false);
    vi.useRealTimers();
  });

  it("bursts the topmost node (lowest y) first", () => {
    vi.useFakeTimers();
    const { demo } = buildDemo();
    const spy = vi.spyOn(demo as any, "fireworkAt");
    demo.celebrateAll();

    vi.runAllTimers();
    expect(spy.mock.calls[0]).toEqual([200, 50]);
    expect(spy.mock.calls[1]).toEqual([200, 150]);
    vi.useRealTimers();
  });
});

describe("WardleyDemo.runDragStep", () => {
  function buildAutoWiredDemo(onComplete: () => void, snapThreshold = 30) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const config: DemoConfig = {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold,
      onComplete,
    };
    WardleyDemo.mount(container, config);
    return container;
  }

  it("fires onComplete when dropped within the snap threshold of the target", () => {
    const onComplete = vi.fn();
    const container = buildAutoWiredDemo(onComplete);
    drag(container.querySelector('[data-node-id="need"]')!, { x: 205, y: 155 });

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("does not fire onComplete when dropped outside the snap threshold", () => {
    const onComplete = vi.fn();
    const container = buildAutoWiredDemo(onComplete);
    drag(container.querySelector('[data-node-id="need"]')!, { x: 20, y: 150 });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("can run multiple drag steps in sequence against the same mounted scene", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "a", label: "A", x: 100, y: 100, draggable: false },
        { id: "b", label: "B", x: 300, y: 100, draggable: false },
      ],
      connections: [],
      snapThreshold: 30,
    });

    const stepA = (): DemoNode => ({ id: "a", label: "A", x: 100, y: 100, draggable: true, start: { x: 0, y: 0 } });
    const stepB = (): DemoNode => ({ id: "b", label: "B", x: 300, y: 100, draggable: true, start: { x: 0, y: 0 } });
    const completedA = vi.fn();
    const completedB = vi.fn();

    demo.runDragStep(stepA(), { snapThreshold: 30, onComplete: completedA });
    drag(container.querySelector('[data-node-id="a"]')!, { x: 105, y: 105 });
    expect(completedA).toHaveBeenCalledOnce();

    demo.runDragStep(stepB(), { snapThreshold: 30, onComplete: completedB });
    drag(container.querySelector('[data-node-id="b"]')!, { x: 302, y: 98 });
    expect(completedB).toHaveBeenCalledOnce();
  });
});

describe("WardleyDemo.skipDrag", () => {
  function buildAutoWiredDemo(onComplete: () => void) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const config: DemoConfig = {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
      onComplete,
    };
    const demo = WardleyDemo.mount(container, config);
    return { demo, container };
  }

  it("completes the pending drag instantly: places the node at its target and fires onComplete", () => {
    const onComplete = vi.fn();
    const { demo, container } = buildAutoWiredDemo(onComplete);

    demo.skipDrag();

    expect(container.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toBe("translate(200, 150)");
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("hides the target marker and charges the node, same as a real snap", () => {
    const { demo, container } = buildAutoWiredDemo(vi.fn());

    demo.skipDrag();

    expect(container.querySelector(".wd-target-marker")!.classList.contains("wd-target-marker--hidden")).toBe(true);
    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(true);
  });

  it("restores the node's opacity when the drag was wired to an external handle", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const handle = document.createElement("div");
    document.body.appendChild(handle);
    const demo = WardleyDemo.mount(
      container,
      {
        viewBox: { width: 400, height: 300 },
        nodes: [{ id: "need", label: "Need", x: 200, y: 150, draggable: true, start: { x: 20, y: 150 } }],
        connections: [],
        snapThreshold: 30,
      },
      { dragHandle: handle },
    );

    demo.skipDrag();

    expect(container.querySelector('[data-node-id="need"]')!.getAttribute("style")).not.toContain("opacity: 0");
  });

  it("is a no-op if no drag step is pending", () => {
    const onComplete = vi.fn();
    const { demo } = buildAutoWiredDemo(onComplete);
    demo.skipDrag();
    onComplete.mockClear();

    expect(() => demo.skipDrag()).not.toThrow();
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("WardleyDemo.runEvolutionDragStep", () => {
  function buildDemo(): { demo: WardleyDemo; container: HTMLElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [
        { id: "user", label: "User", x: 200, y: 50, draggable: false },
        { id: "need", label: "Need", x: 50, y: 150, draggable: false },
      ],
      connections: [{ from: "user", to: "need" }],
      snapThreshold: 30,
    });
    return { demo, container };
  }

  function dragAxis(nodeGroup: Element, fromX: number, toX: number): void {
    nodeGroup.dispatchEvent(new PointerEvent("pointerdown", { clientX: fromX, clientY: 150, pointerId: 1 }));
    nodeGroup.dispatchEvent(new PointerEvent("pointermove", { clientX: toX, clientY: 150, pointerId: 1 }));
    nodeGroup.dispatchEvent(new PointerEvent("pointerup", { clientX: toX, clientY: 150, pointerId: 1 }));
  }

  it("moves the node and its connected line live as it's dragged, reporting the matching stage label", () => {
    const { demo, container } = buildDemo();
    const onPositionChange = vi.fn();
    demo.runEvolutionDragStep("need", { onPositionChange });

    const nodeGroup = container.querySelector('[data-node-id="need"]')!;
    nodeGroup.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 150, pointerId: 1 }));
    nodeGroup.dispatchEvent(new PointerEvent("pointermove", { clientX: 250, clientY: 150, pointerId: 1 }));

    expect(nodeGroup.getAttribute("transform")).toBe("translate(250, 150)");
    expect(container.querySelector(".wd-line")!.getAttribute("x2")).toBe("250");
    expect(onPositionChange).toHaveBeenLastCalledWith("Product");
  });

  it("clamps movement to the viewBox bounds (inset by the node radius)", () => {
    const { demo, container } = buildDemo();
    const onPositionChange = vi.fn();
    demo.runEvolutionDragStep("need", { onPositionChange });

    const nodeGroup = container.querySelector('[data-node-id="need"]')!;
    nodeGroup.dispatchEvent(new PointerEvent("pointerdown", { clientX: 50, clientY: 150, pointerId: 1 }));
    nodeGroup.dispatchEvent(new PointerEvent("pointermove", { clientX: -1000, clientY: 150, pointerId: 1 }));

    expect(nodeGroup.getAttribute("transform")).toBe("translate(48, 150)");
  });

  it("fires onReadyToConfirm once, the first time the node is released, and not again on a second drag", () => {
    const { demo, container } = buildDemo();
    const onReadyToConfirm = vi.fn();
    demo.runEvolutionDragStep("need", { onReadyToConfirm });

    const nodeGroup = container.querySelector('[data-node-id="need"]')!;
    dragAxis(nodeGroup, 50, 150);
    expect(onReadyToConfirm).toHaveBeenCalledOnce();

    dragAxis(nodeGroup, 150, 200);
    expect(onReadyToConfirm).toHaveBeenCalledOnce();
  });

  it("leaves the node wherever it was dropped, without snapping back or auto-committing", () => {
    const { demo, container } = buildDemo();
    demo.runEvolutionDragStep("need");

    dragAxis(container.querySelector('[data-node-id="need"]')!, 50, 150);

    expect(container.querySelector('[data-node-id="need"]')!.getAttribute("transform")).toBe("translate(150, 150)");
  });

  it("confirm() stops the beckon pulse, respawns flow particles, and stops further dragging, without re-charging the node", () => {
    const { demo, container } = buildDemo();
    const evolutionStep = demo.runEvolutionDragStep("need");
    const nodeGroup = container.querySelector('[data-node-id="need"]')!;
    dragAxis(nodeGroup, 50, 150);

    evolutionStep.confirm();

    expect(nodeGroup.classList.contains("wd-node--charged")).toBe(false);
    expect(nodeGroup.classList.contains("wd-node--beckon")).toBe(false);
    expect(container.querySelectorAll(".wd-flow-particle").length).toBeGreaterThan(0);

    dragAxis(nodeGroup, 150, 250);
    expect(nodeGroup.getAttribute("transform")).toBe("translate(150, 150)");
  });
});

describe("WardleyDemo.addAnnotation", () => {
  function buildDemo(): { demo: WardleyDemo; container: HTMLElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const demo = WardleyDemo.mount(container, {
      viewBox: { width: 400, height: 300 },
      nodes: [],
      connections: [],
      snapThreshold: 30,
    });
    return { demo, container };
  }

  it("appends a .wd-annotation callout containing the given text, anchored above the node", () => {
    const { demo, container } = buildDemo();
    demo.addNode({ id: "cap-1", label: "Kettle", x: 200, y: 200, draggable: false });

    demo.addAnnotation("cap-1", "Build");

    const annotation = container.querySelector(".wd-annotation")!;
    expect(annotation).not.toBeNull();
    expect(annotation.querySelector(".wd-annotation-text")!.textContent).toBe("Build");
  });

  it("stacks a second callout that would collide with the first, rather than overlapping it", () => {
    const { demo, container } = buildDemo();
    demo.addNode({ id: "cap-1", label: "Kettle", x: 200, y: 200, draggable: false });
    demo.addNode({ id: "cap-2", label: "Water", x: 200, y: 200, draggable: false });

    demo.addAnnotation("cap-1", "Build");
    demo.addAnnotation("cap-2", "Buy");

    const texts = container.querySelectorAll(".wd-annotation-text");
    const ys = [...texts].map((t) => Number(t.getAttribute("y")));
    expect(ys[0]).not.toBe(ys[1]);
  });
});
