import { injectStylesOnce } from "./styles";

/**
 * renders a big "Next" button (or `label`, if given) into `container`; resolves once the visitor
 * clicks it, then removes the button. Used to gate a step transition behind a deliberate action
 * instead of a guessed timer. Same filled-button treatment as Phase 10's field-submit button
 * (`.wd-panel-form-submit`), since both are "confirm and move on" actions.
 */
export function showNextLink(container: HTMLElement, label = "Next"): Promise<void> {
  injectStylesOnce();
  return new Promise((resolve) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("wd-next-link");
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
