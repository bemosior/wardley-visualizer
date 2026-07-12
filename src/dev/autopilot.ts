import type { WardleyDemo, EvolutionDragHandle } from "../engine/WardleyDemo";

/**
 * named moments in the demo's current (built-so-far) flow that `index.html?skipTo=` can land on.
 * `intro`: skip the Phase 0 drag and all five of the resulting "Next" gates (Phase 0's "You made a
 * Value Chain!" caption, then Phase 5's User/Need/Capability walkthrough and its one-caption
 * "recipe" beat), landing at Phase 7's "I'm Ben, by the way" introduction (its own "Nice to meet
 * you!" gate is left for a real click).
 * `phase10`: also click past Phase 7's "I'm Ben" introduction gate, land at the start of
 * Phase 10's form.
 * `celebrate`: also auto-fill all 5 form fields, land right after the Phase 10 celebration.
 * `phase20`: also click past the Phase 10->20 gate and the evolution-intro gate, land at today's
 * frontier.
 * `finale`: also auto-click every Phase 20 confirm-placement link, land at the placement celebration.
 * `thinking`: also click through both of Phase 25's explanatory beats and into Phase 30, auto-pick
 * the first option for every question, land at the Phase 30 celebration (its own final "What's
 * next →" is still left for a real click).
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
  /** the scenario's avatar-caption host — watched for the mascot's small-caption "Next" links (brief narrative beats, simple gates) */
  avatarHost: HTMLElement;
  /**
   * the scenario's dialog-panel host — watched for everything else the mascot renders: forms,
   * "Confirm placement"/gate links, question buttons. Split across two hosts now that the avatar's
   * caption and the dialog panel are two different DOM regions (see `engine/mascot.ts`); every
   * mutation handler below checks both.
   */
  dialogHost: HTMLElement;
  target: SkipTarget;
}

export interface Autopilot {
  /** pass as `ValueChainScenarioOptions.onMount` — completes the Phase 0 drag instantly */
  onMount: (demo: WardleyDemo) => void;
  /** pass as `ValueChainScenarioOptions.onEvolutionStep` — skips Phase 20 drag steps for `finale`/`thinking`/`recap` */
  onEvolutionStep?: (handle: EvolutionDragHandle) => void;
}

const DEFAULT_TEXT_ANSWER = "Test";

/**
 * advances a Phase 10 field with a default answer, same as a visitor confirming: a `type: "text"`
 * field fills its input and submits the form; a `type: "choice"` field (panel.ts) has no input at
 * all, just pill chips, so this clicks the first one instead.
 */
function fillAndSubmit(field: HTMLElement): void {
  const input = field.querySelector<HTMLInputElement>(".wd-panel-form-input");
  if (input) {
    input.value = input.placeholder || DEFAULT_TEXT_ANSWER;
    field.dispatchEvent(new Event("submit", { cancelable: true }));
    return;
  }
  field.querySelector<HTMLButtonElement>(".wd-panel-form-example")?.click();
}

/**
 * drives the existing public surface (drag, "Next" links, form fields) instantly toward
 * `target`, then stops — leaving the demo exactly where a real visitor would be, ready for
 * manual interaction from that moment forward. Dev/testing convenience; see
 * the-more-of-the-peaceful-sky plan for why this exists instead of a resumable step machine.
 */
export function attachAutopilot({ avatarHost, dialogHost, target }: AutopilotOptions): Autopilot {
  // counts only the plain "Next" links -- Phase 0's opening caption, Phase 5's four gates (the
  // User/Need/Capability walkthrough, plus its one-caption "recipe" beat), and the Phase 10->20
  // gate all share identical link text, so they can't be told apart by content the way every other
  // gate below is (by its own distinct label).
  let plainNextCount = 0;

  function disconnect(): void {
    avatarObserver.disconnect();
    dialogObserver.disconnect();
  }

  /** a "Next"-labeled link can render in either host depending on whether the mascot's last
   * content was a small caption or a dialog-panel render -- check both. */
  function findLink(): HTMLButtonElement | null {
    return (
      avatarHost.querySelector<HTMLButtonElement>(".wd-next-link") ??
      dialogHost.querySelector<HTMLButtonElement>(".wd-next-link")
    );
  }

  /**
   * one handler covering the whole scenario — the mascot renders drag slots/forms/instrument
   * panels/gate links/questions into `dialogHost`, and brief captions/simple confirms into
   * `avatarHost`.
   */
  function handleContentMutation(): void {
    const form = dialogHost.querySelector<HTMLElement>(".wd-panel-form");
    if (form) fillAndSubmit(form);

    const link = findLink();
    const linkText = link?.textContent?.trim();

    if (linkText === "A value chain?") {
      // Phase 0's "it's a recipe" follow-up gate, right after the opening "You made a Value
      // Chain!" caption -- no target stops here, always click through
      link!.click();
    } else if (linkText === "Next") {
      plainNextCount++;
      if (plainNextCount <= 5) {
        // Phase 0's opening caption, then Phase 5's four gates (User/Need/Capability, and the
        // "recipe" beat) -- always skip past them, no target stops here
        link!.click();
      } else if (plainNextCount === 6) {
        // Phase 10 -> Phase 20 gate -- click through it for every target that reaches Phase 20.
        // Every target that stops here for good (celebrate/intro/phase10 never reach this count,
        // they disconnect earlier) still disconnects immediately, same as before this gate got a
        // successor -- except `phase20` itself, which now also has to click past the new
        // evolution-intro gate below before it lands at today's frontier
        if (target === "phase20" || target === "finale" || target === "thinking" || target === "recap") link!.click();
        if (target !== "finale" && target !== "thinking" && target !== "recap" && target !== "phase20") disconnect();
      } else if (plainNextCount === 7) {
        // Phase 20 -> Phase 25 gate (right after "You made a Wardley Map!") -- finale stops at
        // the placement celebration itself, so only thinking/recap click through into Phase 25's
        // first beat
        if (target === "thinking" || target === "recap") link!.click();
      } else if (plainNextCount === 8) {
        // Phase 25's own internal gate, between its two beats -- thinking/recap click through
        // into the second beat before Phase 30's own "Let's get strategic →" gate
        if (target === "thinking" || target === "recap") link!.click();
      } else if (plainNextCount >= 9) {
        // Phase 30's per-answer "Made a note of it here." / "Nothing to note. Got it." asides --
        // one appears after every deep-dive answer, an unbounded number of times as the visitor
        // walks the concept bank, so unlike the gates above this can't be a fixed count
        if (target === "thinking" || target === "recap") link!.click();
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
    } else if (linkText === "Let's try it →") {
      // Phase 20's evolution-intro gate ("Everything evolves.", shown after the map backdrop
      // itself is already visible) -- phase20 stops right after clicking through this one,
      // landing at today's frontier (the map, Need beckoning)
      if (target === "phase20" || target === "finale" || target === "thinking" || target === "recap") link!.click();
      if (target === "phase20") disconnect();
    } else if (linkText === "Confirm placement" && (target === "finale" || target === "thinking" || target === "recap")) {
      // auto-click "Confirm placement" links that appear during Phase 20,
      // but not the finale's "What's next →" which should be left for the visitor
      link!.click();
    } else if (linkText === "Let's get strategic →" && (target === "thinking" || target === "recap")) {
      // auto-click the Phase 25->30 gate, but leave Phase 30's own "What's next →" for the visitor,
      // same as `finale` leaves Phase 20's
      link!.click();
    } else if (linkText === "What's next →" && target === "recap") {
      // auto-click the Phase 30->Finale gate -- the one gate `thinking` leaves for the visitor --
      // to land on the closing recap itself
      link!.click();
      disconnect();
    }

    if (target === "thinking" || target === "recap") {
      const option = dialogHost.querySelector<HTMLButtonElement>(".wd-panel-question-option");
      if (option) option.click();
    }
  }

  const avatarObserver = new MutationObserver(handleContentMutation);
  avatarObserver.observe(avatarHost, { childList: true, subtree: true });
  const dialogObserver = new MutationObserver(handleContentMutation);
  dialogObserver.observe(dialogHost, { childList: true, subtree: true });

  return {
    onMount: (demo) => demo.skipDrag(),
    onEvolutionStep:
      target === "finale" || target === "thinking" || target === "recap"
        ? (handle: EvolutionDragHandle) => handle.skipDrag()
        : undefined,
  };
}
