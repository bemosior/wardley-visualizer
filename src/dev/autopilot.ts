import type { WardleyDemo, EvolutionDragHandle } from "../engine/WardleyDemo";

/**
 * named moments in the demo's current (built-so-far) flow that `index.html?skipTo=` can land on.
 * `intro`: skip the Phase 0 drag and click past all five of Phase 5's "Next" gates ("Need placed"
 * through the Part A/B/C explanation), land at Phase 7's "I'm Ben, by the way" introduction (its
 * own "Nice to meet you!" gate is left for a real click).
 * `phase10`: also click past Phase 7's "I'm Ben" introduction gate, land at the start of
 * Phase 10's form.
 * `celebrate`: also auto-fill all 5 form fields, land right after the Phase 10 celebration.
 * `phase20`: also click past the Phase 10->20 gate, land at today's frontier.
 * `finale`: also auto-click every Phase 20 confirm-placement link, land at the placement celebration.
 * `thinking`: also click into Phase 30 and auto-pick the first option for every question, land at
 * the Phase 30 celebration (its own final "What's next →" is still left for a real click).
 * `recap`: also click that final "What's next →" gate, land on the closing recap + CTA link.
 */
export type SkipTarget = "intro" | "phase10" | "celebrate" | "phase20" | "finale" | "thinking" | "recap";

const SKIP_TARGETS: SkipTarget[] = ["intro", "phase10", "celebrate", "phase20", "finale", "thinking", "recap"];

/** reads `?skipTo=` from a query string (e.g. `location.search`); null if absent/unrecognized */
export function parseSkipTarget(search: string): SkipTarget | null {
  const value = new URLSearchParams(search).get("skipTo");
  return SKIP_TARGETS.find((target) => target === value) ?? null;
}

export interface AutopilotOptions {
  /**
   * the scenario's mascot host container — watched for every auto-fillable/auto-clickable
   * control the mascot renders, from Phase 0's drag affordance through the Phase 30 Q&A: forms,
   * every "Next"/"Confirm placement"/gate link, and question buttons. The mascot renders all of
   * it into this one root for the whole scenario, so a single observer covers every `target`.
   */
  mascotHost: HTMLElement;
  target: SkipTarget;
}

export interface Autopilot {
  /** pass as `ValueChainScenarioOptions.onMount` — completes the Phase 0 drag instantly */
  onMount: (demo: WardleyDemo) => void;
  /** pass as `ValueChainScenarioOptions.onEvolutionStep` — skips Phase 20 drag steps for `finale`/`thinking`/`recap` */
  onEvolutionStep?: (handle: EvolutionDragHandle) => void;
}

const DEFAULT_TEXT_ANSWER = "Test";

/** fills a Phase 10 form field with a default answer and submits it, same as a visitor confirming */
function fillAndSubmit(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>(".wd-panel-form-input");
  if (!input) return;
  input.value = input.placeholder || DEFAULT_TEXT_ANSWER;
  form.dispatchEvent(new Event("submit", { cancelable: true }));
}

/**
 * drives the existing public surface (drag, "Next" links, form fields) instantly toward
 * `target`, then stops — leaving the demo exactly where a real visitor would be, ready for
 * manual interaction from that moment forward. Dev/testing convenience; see
 * the-more-of-the-peaceful-sky plan for why this exists instead of a resumable step machine.
 */
export function attachAutopilot({ mascotHost, target }: AutopilotOptions): Autopilot {
  // counts only the plain "Next" links -- Phase 5's five gates ("Need placed", the User/Need/
  // Capability walkthrough, and the Part A/B/C explanation) and the Phase 10->20 gate all share
  // identical link text, so they can't be told apart by content the way every other gate below is
  // (by its own distinct label).
  let plainNextCount = 0;

  function disconnect(): void {
    observer.disconnect();
  }

  /**
   * one handler covering the whole scenario — the mascot renders every phase's content (drag
   * slots, form, instrument panel, confirm/gate links, questions) into the same root.
   */
  function handleContentMutation(): void {
    const form = mascotHost.querySelector<HTMLFormElement>(".wd-panel-form");
    if (form) fillAndSubmit(form);

    const link = mascotHost.querySelector<HTMLButtonElement>(".wd-next-link");
    const linkText = link?.textContent?.trim();

    if (linkText === "Next") {
      plainNextCount++;
      if (plainNextCount <= 4) {
        // Phase 5's "Need placed" gate, then the User/Need/Capability walkthrough gates --
        // always skip past them, no target stops here
        link!.click();
      } else if (plainNextCount === 5) {
        // Phase 5's Part A/B/C explanation gate -- always skip past it too, into Phase 7's
        // introduction gate
        link!.click();
      } else if (plainNextCount === 6) {
        if (target === "phase20" || target === "finale" || target === "thinking" || target === "recap") link!.click();
        if (target !== "finale" && target !== "thinking" && target !== "recap") disconnect();
      }
    } else if (linkText === "Nice to meet you!") {
      // Phase 7's "I'm Ben" introduction gate -- `intro` lands right here, unclicked; every other
      // target skips past it too, `phase10` landing right after at the start of Phase 10's form
      if (target === "intro") {
        disconnect();
      } else {
        link!.click();
        if (target === "phase10") disconnect();
      }
    } else if (linkText === "Confirm placement" && (target === "finale" || target === "thinking" || target === "recap")) {
      // auto-click "Confirm placement" links that appear during Phase 20,
      // but not the finale's "What's next →" which should be left for the visitor
      link!.click();
    } else if (linkText === "Let's get strategic →" && (target === "thinking" || target === "recap")) {
      // auto-click the Phase 20->30 gate, but leave Phase 30's own "What's next →" for the visitor,
      // same as `finale` leaves Phase 20's
      link!.click();
    } else if (linkText === "What's next →" && target === "recap") {
      // auto-click the Phase 30->Finale gate -- the one gate `thinking` leaves for the visitor --
      // to land on the closing recap itself
      link!.click();
      disconnect();
    }

    if (target === "thinking" || target === "recap") {
      const option = mascotHost.querySelector<HTMLButtonElement>(".wd-panel-question-option");
      if (option) option.click();
    }
  }

  const observer = new MutationObserver(handleContentMutation);
  observer.observe(mascotHost, { childList: true, subtree: true });

  return {
    onMount: (demo) => demo.skipDrag(),
    onEvolutionStep:
      target === "finale" || target === "thinking" || target === "recap"
        ? (handle: EvolutionDragHandle) => handle.skipDrag()
        : undefined,
  };
}
