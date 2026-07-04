import type { WardleyDemo, EvolutionDragHandle } from "../engine/WardleyDemo";
import { NEED_CATALOG } from "../domain/needCatalog";

/**
 * named moments in the demo's current (built-so-far) flow that `index.html?skipTo=` can land on.
 * `phase1`: skip the Phase 0 drag, land at the start of Phase 1's form.
 * `celebrate`: also auto-fill all 5 form fields, land right after the Phase 1 celebration.
 * `phase2`: also click past the Phase 1->2 gate, land at today's frontier.
 * `finale`: also auto-click every Phase 2 confirm-placement link, land at the placement celebration.
 * `thinking`: also click into Phase 3 and auto-pick the first option for every question, land at
 * the Phase 3 celebration (its own final "What's next →" is still left for a real click).
 */
export type SkipTarget = "phase1" | "celebrate" | "phase2" | "finale" | "thinking";

const SKIP_TARGETS: SkipTarget[] = ["phase1", "celebrate", "phase2", "finale", "thinking"];

/** reads `?skipTo=` from a query string (e.g. `location.search`); null if absent/unrecognized */
export function parseSkipTarget(search: string): SkipTarget | null {
  const value = new URLSearchParams(search).get("skipTo");
  return SKIP_TARGETS.find((target) => target === value) ?? null;
}

export interface AutopilotOptions {
  /**
   * the scenario's mascot host container — watched for auto-fillable `.wd-panel-form`s (Phase
   * 0/1 content) as well as the confirm-placement links and question buttons the mascot renders
   * from Phase 2 onward. The mascot renders all of it, from the very start of the scenario, so
   * every caller needs this regardless of `target`.
   */
  mascotHost: HTMLElement;
  /** the scenario's next-link container — watched for `.wd-next-link`s to auto-click */
  nextControl: HTMLElement;
  target: SkipTarget;
}

export interface Autopilot {
  /** pass as `ValueChainScenarioOptions.onMount` — completes the Phase 0 drag instantly */
  onMount: (demo: WardleyDemo) => void;
  /** pass as `ValueChainScenarioOptions.onEvolutionStep` — skips Phase 2 drag steps for `finale`/`thinking` */
  onEvolutionStep?: (handle: EvolutionDragHandle) => void;
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
export function attachAutopilot({ mascotHost, nextControl, target }: AutopilotOptions): Autopilot {
  let nextLinkCount = 0;

  function disconnect(): void {
    nextObserver.disconnect();
    mascotObserver.disconnect();
  }

  const nextObserver = new MutationObserver(() => {
    const link = nextControl.querySelector<HTMLAnchorElement>(".wd-next-link");
    if (!link) return;
    nextLinkCount++;
    if (nextLinkCount === 1) {
      link.click();
      if (target === "phase1") disconnect();
    } else if (nextLinkCount === 2) {
      if (target === "phase2" || target === "finale" || target === "thinking") link.click();
      if (target !== "finale" && target !== "thinking") disconnect();
    }
  });

  /**
   * drives the single mascot-host observer below — the mascot renders every phase's content
   * (drag slots, form, instrument panel, confirm links, questions) into the same root, so one
   * handler covers all of it.
   */
  function handleContentMutation(root: HTMLElement): void {
    const form = root.querySelector<HTMLFormElement>(".wd-panel-form");
    if (form) fillAndSubmit(form);
    if (target === "finale" || target === "thinking") {
      // auto-click "Confirm placement" links that appear during Phase 2,
      // but not the finale's "What's next →" which should be left for the visitor
      const link = root.querySelector<HTMLAnchorElement>(".wd-next-link");
      if (link && link.textContent?.trim() === "Confirm placement") link.click();
    }
    if (target === "thinking") {
      // auto-click the Phase 2->3 gate and every question's first option, but leave Phase 3's
      // own "What's next →" for the visitor, same as `finale` leaves Phase 2's
      const gateLink = root.querySelector<HTMLAnchorElement>(".wd-next-link");
      if (gateLink && gateLink.textContent?.trim() === "Let's think about it →") gateLink.click();
      const option = root.querySelector<HTMLButtonElement>(".wd-panel-question-option");
      if (option) option.click();
    }
  }

  const mascotObserver = new MutationObserver(() => handleContentMutation(mascotHost));

  nextObserver.observe(nextControl, { childList: true });
  if (target !== "phase1") {
    mascotObserver.observe(mascotHost, { childList: true, subtree: true });
  }

  return {
    onMount: (demo) => demo.skipDrag(),
    onEvolutionStep:
      target === "finale" || target === "thinking" ? (handle: EvolutionDragHandle) => handle.skipDrag() : undefined,
  };
}
