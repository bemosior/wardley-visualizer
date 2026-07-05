import { NODE_RADIUS } from "../../engine/render";
import type { ScenarioContext } from "./index";

const MASCOT_INTRO = {
  heading: "I'm Ben, by the way.",
  subheading:
    "I'm here to help you learn Wardley Mapping. Use the contact form at the bottom of this page anytime to say hello or ask a question!",
};

/** vertical clearance kept below the value chain's lowest node before the mascot's introduction spot, so the bubble never overlaps a Capability */
const STEP_BACK_MARGIN = 40;

/** clearance kept above the viewBox's own bottom edge, so the spot stays on-canvas even on a tall custom config */
const CANVAS_BOTTOM_MARGIN = 20;

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
  const ids = [chain.user.id, chain.need.id, ...chain.capabilities.map((capability) => capability.id)];
  const lowestY = Math.max(...ids.map((id) => demo.getNodePosition(id)!.y));
  const y = Math.min(lowestY + NODE_RADIUS + STEP_BACK_MARGIN, viewBox.height - CANVAS_BOTTOM_MARGIN);
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
  await mascot.confirmPlacement("Next");
}
