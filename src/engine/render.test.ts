import { describe, expect, it } from "vitest";
import { createMapBackdrop, createMapCaption, genesisCenterX } from "./render";

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
