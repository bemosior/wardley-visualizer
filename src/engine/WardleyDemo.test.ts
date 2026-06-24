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

describe("WardleyDemo.celebrate", () => {
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

  it("activates every line and charges every node", () => {
    const { demo, container } = buildDemo();
    demo.celebrate("need");

    expect(container.querySelector(".wd-line")!.classList.contains("wd-line--active")).toBe(true);
    expect(container.querySelector('[data-node-id="user"]')!.classList.contains("wd-node--charged")).toBe(true);
    expect(container.querySelector('[data-node-id="need"]')!.classList.contains("wd-node--charged")).toBe(true);
  });

  it("does nothing if the node id isn't registered", () => {
    const { demo, container } = buildDemo();
    expect(() => demo.celebrate("missing")).not.toThrow();
    expect(container.querySelector(".wd-line")!.classList.contains("wd-line--active")).toBe(false);
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
