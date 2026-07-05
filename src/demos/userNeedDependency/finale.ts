import type { ScenarioContext } from "./index";

/**
 * Finale: recap and exit. Waits for the visitor to click "What's next →" (the Phase 30 -> Finale
 * gate), then swaps the mascot's bubble to `Mascot.showRecap` — a three-line recap of the whole
 * session (value chain, map, strategic thinking) plus an external CTA link to
 * LearnWardleyMapping.com — before firing `onComplete`.
 */
export async function runFinale(ctx: ScenarioContext): Promise<void> {
  const { mascot, options } = ctx;

  await mascot.confirmPlacement("What's next →");
  mascot.showRecap(
    ["You made a Value Chain", "Then you turned it into a Wardley Map", "And finally, you used the map for strategic thinking! Well done!"],
    { label: "Take your next step →", href: "https://learnwardleymapping.com" },
  );
  mascot.setState("celebrating");
  options.onComplete?.();
}
