import type { ScenarioContext } from "./index";

const MASCOT_GATHER_TO_THINK =
  "Now we gather around the map to think and discuss our strategy together.";
const MASCOT_SPECIAL_QUESTIONS =
  "We use dozens of special questions to find gaps and surface new ideas. Want to try?";

/**
 * Phase 25: between Phase 20 (evolution placement) and Phase 30 (the Q&A loop). Waits for the
 * Phase 20 -> Phase 25 "Next" gate (appended to Phase 20's "You made a Wardley Map!" placeholder),
 * resets the mascot out of its celebrating pose, then plays two beats -- why we're gathering
 * around the map, then what we're about to do with it -- separated by their own "Next" gate,
 * before Phase 30's own "Let's get strategic ->" gate hands off into the Q&A loop.
 */
export async function runPhase25(ctx: ScenarioContext): Promise<void> {
  const { mascot } = ctx;

  await mascot.confirmPlacement("Next");
  mascot.setState("idle");
  mascot.say(MASCOT_GATHER_TO_THINK);
  await mascot.confirmPlacement("Next");
  mascot.say(MASCOT_SPECIAL_QUESTIONS);
}
