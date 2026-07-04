import { describe, expect, it } from "vitest";
import {
  buildFlowParticlePath,
  createAnnotation,
  createFlowParticles,
  createMapBackdrop,
  createMapCaption,
  flowParamsForStage,
  genesisCenterX,
  rollMissStopPercent,
  stageLabelAt,
  type AnnotationRect,
} from "./render";
import type { DemoConnection, DemoNode } from "./types";

describe("createMapBackdrop", () => {
  it("renders 4 equal-width bands spanning the viewBox, in stage order", () => {
    const g = createMapBackdrop({ width: 400, height: 300 });
    const bands = g.querySelectorAll(".wd-backdrop-band");

    expect(bands).toHaveLength(4);
    expect(["genesis", "custom", "product", "commodity"].every((stage, i) =>
      bands[i].classList.contains(`wd-backdrop-band--${stage}`),
    )).toBe(true);

    bands.forEach((band, i) => {
      expect(band.getAttribute("x")).toBe(String(i * 100));
      expect(band.getAttribute("width")).toBe("100");
      expect(band.getAttribute("height")).toBe("300");
    });
  });

  it("renders 3 dividers at the band boundaries", () => {
    const g = createMapBackdrop({ width: 400, height: 300 });
    const dividers = g.querySelectorAll(".wd-backdrop-divider");

    expect(dividers).toHaveLength(3);
    expect([...dividers].map((d) => d.getAttribute("x1"))).toEqual(["100", "200", "300"]);
  });

  it("renders 4 centered stage labels with the correct text", () => {
    const g = createMapBackdrop({ width: 400, height: 300 });
    const labels = g.querySelectorAll(".wd-backdrop-label");

    expect([...labels].map((l) => l.textContent)).toEqual(["Genesis", "Custom-Built", "Product", "Commodity"]);
    expect(labels[0].getAttribute("x")).toBe("50");
    expect(labels[1].getAttribute("x")).toBe("150");
  });

  it("spans the full viewBox height regardless of aspect ratio, so the whole value chain sits on the map", () => {
    const g = createMapBackdrop({ width: 400, height: 520 });
    const band = g.querySelector(".wd-backdrop-band")!;
    const divider = g.querySelector(".wd-backdrop-divider")!;
    const label = g.querySelector(".wd-backdrop-label")!;

    expect(band.getAttribute("y")).toBe("0");
    expect(band.getAttribute("height")).toBe("520");
    expect(divider.getAttribute("y1")).toBe("0");
    expect(divider.getAttribute("y2")).toBe("520");
    expect(label.getAttribute("y")).toBe("506");
  });
});

describe("genesisCenterX", () => {
  it("matches the x of the Genesis band's own centered label", () => {
    const g = createMapBackdrop({ width: 400, height: 300 });
    const genesisLabel = g.querySelector(".wd-backdrop-label")!;

    expect(genesisCenterX(400)).toBe(Number(genesisLabel.getAttribute("x")));
  });

  it("is one eighth of the viewBox width", () => {
    expect(genesisCenterX(800)).toBe(100);
  });
});

describe("stageLabelAt", () => {
  it("returns each of the four stage names across the x range, matching the backdrop's own bands", () => {
    expect(stageLabelAt(50, 400)).toBe("Genesis");
    expect(stageLabelAt(150, 400)).toBe("Custom-Built");
    expect(stageLabelAt(250, 400)).toBe("Product");
    expect(stageLabelAt(350, 400)).toBe("Commodity");
  });

  it("clamps to the first stage for negative x", () => {
    expect(stageLabelAt(-20, 400)).toBe("Genesis");
  });

  it("clamps to the last stage for x beyond the viewBox width", () => {
    expect(stageLabelAt(1000, 400)).toBe("Commodity");
  });

  it("treats a band boundary as belonging to the band to its right", () => {
    expect(stageLabelAt(100, 400)).toBe("Custom-Built");
  });
});

describe("createAnnotation", () => {
  const node: DemoNode = { id: "cap-1", label: "Kettle", x: 200, y: 200, draggable: false };

  it("renders a leader line, background box, and the given text, anchored above the node", () => {
    const { element, rect } = createAnnotation(node, "Build", []);

    const leader = element.querySelector(".wd-annotation-leader")!;
    expect(leader.getAttribute("x1")).toBe("200");
    expect(Number(leader.getAttribute("y1"))).toBeLessThan(node.y);

    const bg = element.querySelector(".wd-annotation-bg")!;
    expect(bg).not.toBeNull();

    const text = element.querySelector(".wd-annotation-text")!;
    expect(text.textContent).toBe("Build");

    expect(rect.tier).toBe(0);
    expect(rect.xMin).toBeLessThan(node.x);
    expect(rect.xMax).toBeGreaterThan(node.x);
  });

  it("places a callout that would collide with an already-placed one at a higher tier", () => {
    const first = createAnnotation(node, "Build", []);
    const second = createAnnotation(node, "Watch: novelty bias", [first.rect]);

    expect(second.rect.tier).toBe(1);
  });

  it("does not bump the tier for a callout far enough away to not collide", () => {
    const placed: AnnotationRect[] = [{ xMin: 0, xMax: 20, tier: 0 }];
    const farNode: DemoNode = { ...node, x: 500 };

    const { rect } = createAnnotation(farNode, "Buy", placed);

    expect(rect.tier).toBe(0);
  });
});

describe("createMapCaption", () => {
  it("renders the given text at the given position, starting invisible", () => {
    const caption = createMapCaption("Let's turn it into a Wardley Map!", 550, 260);

    expect(caption.textContent).toBe("Let's turn it into a Wardley Map!");
    expect(caption.getAttribute("x")).toBe("550");
    expect(caption.getAttribute("y")).toBe("260");
    expect(caption.classList.contains("wd-map-caption")).toBe(true);
    expect(caption.classList.contains("wd-map-caption--visible")).toBe(false);
  });

  it("renders *word*-delimited segments as separate italic tspans, joining back into the full plain text", () => {
    const caption = createMapCaption("Now let's turn the *Value Chain* into a *Wardley Map*!", 550, 260);

    expect(caption.textContent).toBe("Now let's turn the Value Chain into a Wardley Map!");

    const tspans = caption.querySelectorAll("tspan");
    expect([...tspans].map((t) => t.textContent)).toEqual([
      "Now let's turn the ",
      "Value Chain",
      " into a ",
      "Wardley Map",
      "!",
    ]);
    expect([...tspans].map((t) => t.classList.contains("wd-map-caption-em"))).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it("splits \\r\\n line breaks into one centered x/dy tspan per line, since SVG ignores literal newlines", () => {
    const caption = createMapCaption("Now let's turn your *Value Chain*\r\ninto a *Wardley Map*!", 550, 260);

    expect(caption.textContent).toBe("Now let's turn your Value Chaininto a Wardley Map!");

    const lineSpans = caption.querySelectorAll(":scope > tspan");
    expect(lineSpans).toHaveLength(2);
    expect(lineSpans[0].getAttribute("x")).toBe("550");
    expect(lineSpans[1].getAttribute("x")).toBe("550");
    expect(lineSpans[0].getAttribute("dy")).toBe("-0.65em");
    expect(lineSpans[1].getAttribute("dy")).toBe("1.3em");

    expect(lineSpans[0].textContent).toBe("Now let's turn your Value Chain");
    expect(lineSpans[1].textContent).toBe("into a Wardley Map!");
    expect(lineSpans[0].querySelector(".wd-map-caption-em")?.textContent).toBe("Value Chain");
    expect(lineSpans[1].querySelector(".wd-map-caption-em")?.textContent).toBe("Wardley Map");
  });

  it("does not wrap single-line text in a line tspan, keeping segment tspans direct children of <text>", () => {
    const caption = createMapCaption("Plain caption", 100, 50);
    const directTspans = caption.querySelectorAll(":scope > tspan");
    expect(directTspans).toHaveLength(1);
    expect(directTspans[0].hasAttribute("dy")).toBe(false);
  });
});

describe("buildFlowParticlePath", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 0 };

  it("returns the straight line path unchanged when orbitAmplitude is 0", () => {
    const path = buildFlowParticlePath(from, to, { orbitAmplitude: 0, orbitCount: 4 });
    expect(path).toBe(`path("M 0,0 L 100,0")`);
  });

  it("returns the straight line path unchanged when orbitCount is 0", () => {
    const path = buildFlowParticlePath(from, to, { orbitAmplitude: 0.4, orbitCount: 0 });
    expect(path).toBe(`path("M 0,0 L 100,0")`);
  });

  it("returns the straight line path for a degenerate zero-length line", () => {
    const path = buildFlowParticlePath(from, from, { orbitAmplitude: 0.5, orbitCount: 4 });
    expect(path).toBe(`path("M 0,0 L 0,0")`);
  });

  it("starts exactly at the source and ends exactly at the supplier, weaving through orbitCount bows in between", () => {
    const path = buildFlowParticlePath(from, to, { orbitAmplitude: 0.4, orbitCount: 3 });
    expect(path.startsWith(`path("M 0,0 `)).toBe(true);
    expect(path.endsWith(`100.00,0.00")`)).toBe(true);
    expect(path.match(/ Q /g)).toHaveLength(3);
  });

  it("rolls a different wobble each call, so two paths for the same connection differ", () => {
    const first = buildFlowParticlePath(from, to, { orbitAmplitude: 0.4, orbitCount: 4 });
    const second = buildFlowParticlePath(from, to, { orbitAmplitude: 0.4, orbitCount: 4 });
    expect(first).not.toBe(second);
  });
});

describe("rollMissStopPercent", () => {
  it("always completes the trip (returns null) when missChance is 0", () => {
    for (let i = 0; i < 20; i++) {
      expect(rollMissStopPercent(0)).toBeNull();
    }
  });

  it("always fades out short of arriving (returns a positive percentage) when missChance is 1", () => {
    for (let i = 0; i < 20; i++) {
      const stopPercent = rollMissStopPercent(1);
      expect(stopPercent).not.toBeNull();
      expect(stopPercent!).toBeGreaterThan(0);
      expect(stopPercent!).toBeLessThan(100);
    }
  });
});

describe("flowParamsForStage", () => {
  it("gives Product and Commodity a straight, certain path (unchanged from a plain line)", () => {
    expect(flowParamsForStage("Product")).toMatchObject({ orbitAmplitude: 0, orbitCount: 0, missChance: 0 });
    expect(flowParamsForStage("Commodity")).toMatchObject({ orbitAmplitude: 0, orbitCount: 0, missChance: 0 });
  });

  it("gives Genesis the widest, most miss-prone orbit", () => {
    const genesis = flowParamsForStage("Genesis");
    const customBuilt = flowParamsForStage("Custom-Built");
    expect(genesis.orbitAmplitude).toBeGreaterThan(customBuilt.orbitAmplitude);
    expect(genesis.orbitCount).toBeGreaterThan(customBuilt.orbitCount);
    expect(genesis.missChance).toBeGreaterThan(customBuilt.missChance);
    expect(customBuilt.orbitAmplitude).toBeGreaterThan(0);
    expect(customBuilt.missChance).toBeGreaterThan(0);
  });

  it("falls back to a straight, certain path when no stage is given", () => {
    expect(flowParamsForStage(undefined)).toMatchObject({ orbitAmplitude: 0, orbitCount: 0, missChance: 0 });
  });
});

describe("createFlowParticles", () => {
  const conn: DemoConnection = { from: "need", to: "cap-1" };
  const nodesById = new Map<string, DemoNode>([
    ["need", { id: "need", label: "Need", x: 0, y: 0, draggable: false }],
    ["cap-1", { id: "cap-1", label: "Capability", x: 100, y: 0, draggable: false }],
  ]);

  it("keeps Product/Commodity/undefined stages on a straight line, same as before curves existed", () => {
    for (const stage of [undefined, "Product", "Commodity"] as const) {
      const particles = createFlowParticles(conn, nodesById, stage);
      particles.forEach((p) => {
        expect(p.style.offsetPath).toBe(`path("M 0,0 L 100,0")`);
        expect(p.style.offsetPath).not.toContain(" Q ");
        expect(p.style.getPropertyValue("--wd-stop-distance")).toBe("");
      });
    }
  });

  it("gives Commodity 4 fast particles and Product 3, matching today's tuning", () => {
    const commodity = createFlowParticles(conn, nodesById, "Commodity");
    expect(commodity).toHaveLength(4);
    expect(commodity[0].style.animationDuration).toBe("1.3s");

    const product = createFlowParticles(conn, nodesById, "Product");
    expect(product).toHaveLength(3);
    expect(product[0].style.animationDuration).toBe("1.9s");
  });

  it("orbits every Genesis/Custom-Built particle's path", () => {
    for (const stage of ["Genesis", "Custom-Built"] as const) {
      const particles = createFlowParticles(conn, nodesById, stage);
      particles.forEach((p) => expect(p.style.offsetPath).toContain(" Q "));
    }
  });

  it("rolls an independent orbit per particle, so Custom-Built's two particles differ", () => {
    const particles = createFlowParticles(conn, nodesById, "Custom-Built");
    expect(particles).toHaveLength(2);
    expect(particles[0].style.offsetPath).not.toBe(particles[1].style.offsetPath);
  });

  it("gives most Genesis particles a --wd-stop-distance so they fade out before arriving", () => {
    let missed = 0;
    for (let i = 0; i < 30; i++) {
      const [particle] = createFlowParticles(conn, nodesById, "Genesis");
      if (particle.style.getPropertyValue("--wd-stop-distance") !== "") missed++;
    }
    expect(missed).toBeGreaterThan(15);
  });

  it("no longer applies a sputter class to any stage", () => {
    (["Genesis", "Custom-Built", "Product", "Commodity", undefined] as const).forEach((stage) => {
      createFlowParticles(conn, nodesById, stage).forEach((p) => {
        expect(p.classList.contains("wd-flow-particle--sputter")).toBe(false);
      });
    });
  });
});
