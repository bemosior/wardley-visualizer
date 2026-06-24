import { describe, expect, it } from "vitest";
import { createValueChain } from "../domain/valueChain";
import { layoutValueChain } from "./valueChainLayout";

function chainWithCapabilities(count: number) {
  return createValueChain({
    user: { id: "user", label: "User" },
    need: { id: "need", label: "Need" },
    capabilities: Array.from({ length: count }, (_, i) => ({ id: `capability-${i + 1}`, label: "Capability" })),
  });
}

describe("layoutValueChain defaults", () => {
  it("places user and need on the vertical centerline", () => {
    const config = layoutValueChain(chainWithCapabilities(2));
    const centerX = config.viewBox.width / 2;
    const user = config.nodes.find((n) => n.id === "user")!;
    const need = config.nodes.find((n) => n.id === "need")!;

    expect(user.x).toBe(centerX);
    expect(need.x).toBe(centerX);
  });

  it("only the need is draggable, with a start position", () => {
    const config = layoutValueChain(chainWithCapabilities(2));

    for (const node of config.nodes) {
      if (node.id === "need") {
        expect(node.draggable).toBe(true);
        expect(node.start).toBeDefined();
      } else {
        expect(node.draggable).toBe(false);
        expect(node.start).toBeUndefined();
      }
    }
  });

  it("centers a single capability on the centerline", () => {
    const config = layoutValueChain(chainWithCapabilities(1));
    const centerX = config.viewBox.width / 2;
    const capability = config.nodes.find((n) => n.id === "capability-1")!;

    expect(capability.x).toBe(centerX);
  });

  it("spreads three capabilities evenly around the centerline", () => {
    const config = layoutValueChain(chainWithCapabilities(3), { capabilityGap: 140 });
    const centerX = config.viewBox.width / 2;
    const xs = ["capability-1", "capability-2", "capability-3"].map(
      (id) => config.nodes.find((n) => n.id === id)!.x,
    );

    expect(xs).toEqual([centerX - 140, centerX, centerX + 140]);
  });

  it("defaults the snap threshold to 30", () => {
    const config = layoutValueChain(chainWithCapabilities(2));
    expect(config.snapThreshold).toBe(30);
  });
});

describe("layoutValueChain overrides", () => {
  it("honors a custom viewBox and snapThreshold", () => {
    const config = layoutValueChain(chainWithCapabilities(1), {
      viewBox: { width: 500, height: 400 },
      snapThreshold: 50,
    });

    expect(config.viewBox).toEqual({ width: 500, height: 400 });
    expect(config.snapThreshold).toBe(50);
  });

  it("defaults the need's start position level with a custom needY when needStart isn't given", () => {
    const config = layoutValueChain(chainWithCapabilities(1), { needY: 90 });
    const need = config.nodes.find((n) => n.id === "need")!;

    expect(need.start).toEqual({ x: 35, y: 90 });
  });

  it("honors an explicit needStart over the needY-derived default", () => {
    const config = layoutValueChain(chainWithCapabilities(1), { needY: 90, needStart: { x: 10, y: 20 } });
    const need = config.nodes.find((n) => n.id === "need")!;

    expect(need.start).toEqual({ x: 10, y: 20 });
  });

  it("marks no node draggable when draggable: false is passed", () => {
    const config = layoutValueChain(chainWithCapabilities(2), { draggable: false });

    for (const node of config.nodes) {
      expect(node.draggable).toBe(false);
      expect(node.start).toBeUndefined();
    }
  });
});
