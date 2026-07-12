import type { ScenarioContext } from "./index";

const MASCOT_THINKING_STRATEGICALLY =
  "Use the map to think. To make a strategy, we ask the map special questions that help us think strategically.";

/**
 * Phase 25: between Phase 20 (evolution placement) and Phase 30 (the Q&A loop). Waits for the
 * Phase 20 -> Phase 25 "Next" gate (appended to Phase 20's "You made a Wardley Map!" placeholder),
 * resets the mascot out of its celebrating pose, then explains why the map itself isn't the
 * point -- before Phase 30's own "Let's get strategic ->" gate hands off into the Q&A loop.
 */
export async function runPhase25(ctx: ScenarioContext): Promise<void> {
  const { mascot } = ctx;

  await mascot.confirmPlacement("Next");
  mascot.setState("idle");
  mascot.say(MASCOT_THINKING_STRATEGICALLY);
}
