import type { ScenarioContext } from "./index";

const MASCOT_INTRO = {
  heading: "I'm Ben, by the way.",
  subheading:
    "I'm here to help you learn Wardley Mapping!",
};

/**
 * an open patch of canvas whitespace below the whole value chain, in viewBox coordinates — not
 * anchored to any node, unlike every other phase's mascot placement. Derived from the chain's own
 * lowest node (rather than a hardcoded default-layout constant) so it stays clear of the row
 * regardless of `layout`/`config` overrides (see `ValueChainScenarioOptions`), and clamped to the
 * viewBox's own bottom edge so it never lands off-canvas.
 */
function stepBackPoint(ctx: ScenarioContext): { x: number; y: number } {
  const { demo, chain } = ctx;
  const viewBox = demo.getViewBoxSize();
  const userPos = demo.getNodePosition(chain.user.id)!;
  const needPos = demo.getNodePosition(chain.need.id)!;
  const posDiffY = needPos.y - userPos.y;
  const y = needPos.y - posDiffY;
  return { x: viewBox.width / 2, y };
}

/**
 * Phase 7: a brief pause between Phase 5 (the value-chain walkthrough) and Phase 10 (the
 * personalization form) where the mascot steps back from the chain to introduce itself, as if
 * taking a moment away from the teaching to say hello. Plants the mascot in open canvas
 * whitespace via `Mascot.moveToViewBoxPoint` instead of beside any node (every other phase anchors
 * to one), then waits for a "Next" gate before handing off to Phase 10.
 */
export async function runPhase7(ctx: ScenarioContext): Promise<void> {
  const { mascot } = ctx;

  const { x, y } = stepBackPoint(ctx);
  mascot.moveToViewBoxPoint(x, y, "auto");
  mascot.showPlaceholder(MASCOT_INTRO.heading, MASCOT_INTRO.subheading);
  await mascot.confirmPlacement("Nice to meet you!");
}
