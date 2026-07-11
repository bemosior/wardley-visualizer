import { injectStylesOnce } from "./styles";

/**
 * renders a "Next" button (or `label`, if given) into `container`; resolves once the visitor
 * clicks it, then removes the button. Used to gate a step transition behind a deliberate action
 * instead of a guessed timer. Same filled-button treatment as Phase 10's field-submit button
 * (`.wd-panel-form-submit`) by default; pass `compact: true` for the smaller pill treatment used
 * everywhere a confirm control shares space with the mascot's small caption or an in-context
 * panel readout (`Mascot.confirmPlacement`) rather than standing alone as a deliberate commitment
 * (the recap CTA, a form submit).
 */
export function showNextLink(container: HTMLElement, label = "Next", options?: { compact?: boolean }): Promise<void> {
  injectStylesOnce();
  return new Promise((resolve) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("wd-next-link");
    if (options?.compact) button.classList.add("wd-next-link--compact");
    button.textContent = label;
    button.addEventListener(
      "click",
      () => {
        button.remove();
        resolve();
      },
      { once: true },
    );
    container.appendChild(button);
  });
}
