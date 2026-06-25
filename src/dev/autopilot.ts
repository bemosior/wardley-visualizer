import type { WardleyDemo } from "../engine/WardleyDemo";
import { NEED_CATALOG } from "../domain/needCatalog";

/**
 * named moments in the demo's current (built-so-far) flow that `index.html?skipTo=` can land on.
 * `phase1`: skip the Phase 0 drag, land at the start of Phase 1's form.
 * `celebrate`: also auto-fill all 5 form fields, land right after the Phase 1 celebration.
 * `phase2`: also click past the Phase 1->2 gate, land at today's frontier.
 */
export type SkipTarget = "phase1" | "celebrate" | "phase2";

const SKIP_TARGETS: SkipTarget[] = ["phase1", "celebrate", "phase2"];

/** reads `?skipTo=` from a query string (e.g. `location.search`); null if absent/unrecognized */
export function parseSkipTarget(search: string): SkipTarget | null {
  const value = new URLSearchParams(search).get("skipTo");
  return SKIP_TARGETS.find((target) => target === value) ?? null;
}

export interface AutopilotOptions {
  /** the scenario's toolbox container — watched for auto-fillable `.wd-panel-form`s */
  toolbox: HTMLElement;
  /** the scenario's next-link container — watched for `.wd-next-link`s to auto-click */
  nextControl: HTMLElement;
  target: SkipTarget;
}

export interface Autopilot {
  /** pass as `ValueChainScenarioOptions.onMount` — completes the Phase 0 drag instantly */
  onMount: (demo: WardleyDemo) => void;
}

const DEFAULT_TEXT_ANSWER = "Test";

/** fills a Phase 1 form field with a default answer and submits it, same as a visitor confirming */
function fillAndSubmit(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement | HTMLSelectElement>(".wd-panel-form-input");
  if (!input) return;
  if (input instanceof HTMLSelectElement) {
    input.value = NEED_CATALOG[0].id;
  } else {
    input.value = input.placeholder || DEFAULT_TEXT_ANSWER;
  }
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

/**
 * drives the existing public surface (drag, "Next" links, form fields) instantly toward
 * `target`, then stops — leaving the demo exactly where a real visitor would be, ready for
 * manual interaction from that moment forward. Dev/testing convenience; see
 * the-more-of-the-peaceful-sky plan for why this exists instead of a resumable step machine.
 */
export function attachAutopilot({ toolbox, nextControl, target }: AutopilotOptions): Autopilot {
  let nextLinkCount = 0;

  function disconnect(): void {
    nextObserver.disconnect();
    toolboxObserver.disconnect();
  }

  const nextObserver = new MutationObserver(() => {
    const link = nextControl.querySelector<HTMLAnchorElement>(".wd-next-link");
    if (!link) return;
    nextLinkCount++;
    if (nextLinkCount === 1) {
      link.click();
      if (target === "phase1") disconnect();
    } else if (nextLinkCount === 2) {
      if (target === "phase2") link.click();
      disconnect();
    }
  });

  const toolboxObserver = new MutationObserver(() => {
    const form = toolbox.querySelector<HTMLFormElement>(".wd-panel-form");
    if (form) fillAndSubmit(form);
  });

  nextObserver.observe(nextControl, { childList: true });
  if (target !== "phase1") {
    toolboxObserver.observe(toolbox, { childList: true });
  }

  return {
    onMount: (demo) => demo.skipDrag(),
  };
}
