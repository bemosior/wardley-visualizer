import { describe, expect, it } from "vitest";
import { showNextLink } from "./nextLink";

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("showNextLink", () => {
  it("renders a Next link into the given container", () => {
    const container = makeContainer();
    showNextLink(container);

    const link = container.querySelector(".wd-next-link");
    expect(link).not.toBeNull();
    expect(link!.textContent).toBe("Next");
  });

  it("does not resolve until the link is clicked", async () => {
    const container = makeContainer();
    let resolved = false;
    showNextLink(container).then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);
  });

  it("resolves and removes the link once clicked", async () => {
    const container = makeContainer();
    const result = showNextLink(container);

    container.querySelector<HTMLButtonElement>(".wd-next-link")!.click();
    await result;

    expect(container.querySelector(".wd-next-link")).toBeNull();
  });

  it("renders a custom label when given", () => {
    const container = makeContainer();
    showNextLink(container, "Confirm placement");

    expect(container.querySelector(".wd-next-link")!.textContent).toBe("Confirm placement");
  });
});
