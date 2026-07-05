import { relabelCapability } from "../../domain/valueChain";
import { DEFAULT_CAPABILITY_GAP } from "../../application/valueChainLayout";
import type { ScenarioContext } from "./index";

/** the mascot's Phase 0 -> Phase 5 "waiting for Next" pause. Doubles as the "what's a Value
 * Chain?" payoff that used to live in the host page's separate `.wd-explanation` column
 * (`#vc-answer`) — now the bubble is the only place that copy lives. Moved here from
 * `phase10.ts` so it gates into the Part A/B/C beat below instead of straight into the form. */
const MASCOT_NEED_PLACED = {
  heading: "Nice! You made a Value Chain!",
  subheading: "A value chain is a recipe:\nWho needs what, and how they get it.",
};

/** placeholder labels for the three Capability nodes while this phase explains their number,
 * before Phase 10's form overwrites them with the visitor's own answers. Assigned left-to-right
 * by final screen position, not domain id order — see the sort in `runPhase5` below. */
const PART_LABELS = ["Part A", "Part B", "Part C"];

const MASCOT_MULTIPLE_PARTS = {
  heading: "The recipe often calls for multiple parts.",
  subheading: "Together, they add up to a solution that meets the need.",
};

/**
 * Phase 5: between Phase 0 (drag the Need into place) and Phase 10 (personalize via the form).
 * Shows the "You just made a Value Chain!" placeholder and waits for the Phase 0 -> Phase 5 "Next"
 * gate (moved here from `phase10.ts`).
 *
 * Phase 0's config is allowed to render only *one* Capability node (e.g. `preview.html`'s
 * hand-tuned host-embed config, which deliberately shows a single "How their need gets met" node
 * to keep the opening puzzle simple) — but Phase 5 must show all three, since its whole point is
 * demonstrating that a need is sometimes met by multiple parts. So this phase first adds whichever
 * of the three Capability nodes aren't already registered (`demo.hasNode`), spreading any missing
 * ones into the empty slots on either side of whichever one *is* already there (that node becomes
 * the row's visual center — `DEFAULT_CAPABILITY_GAP` on either side, same spacing
 * `valueChainLayout.ts` uses when it renders all three from the start), and connects each new node
 * to the Need (nothing to do here for `index.html`'s default layout, which already renders all
 * three from Phase 0 — the "missing" list is just empty).
 *
 * Once all three exist, relabels them "Part A"/"Part B"/"Part C" *by final left-to-right screen
 * position* (not by domain id order, since a host config's pre-existing node isn't necessarily
 * `dependency-1`), re-anchors the mascot below the visually-centered one (the middle of the sorted
 * row — see `[[project_wardley_demo_mascot_bubble_geometry]]` memory on why the mascot anchors
 * *below the whole row* here rather than beside one node), and explains that a need is sometimes
 * met by multiple parts adding up together. Waits for a second "Next" gate before returning, so the
 * caller (`phase10.ts`) can start directly with "What does the user need?" instead of also showing
 * the "Need placed" placeholder itself.
 */
export async function runPhase5(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot } = ctx;

  mascot.showPlaceholder(MASCOT_NEED_PLACED.heading, MASCOT_NEED_PLACED.subheading);
  await mascot.confirmPlacement("Next");

  const capabilities = ctx.chain.capabilities;
  const missing = capabilities.filter((capability) => !demo.hasNode(capability.id));
  if (missing.length > 0) {
    const anchor = capabilities.find((capability) => demo.hasNode(capability.id))!;
    const anchorPos = demo.getNodePosition(anchor.id)!;
    const sideOffsets = [-1, 1]; // left/right slots around the already-rendered node
    missing.forEach((capability, i) => {
      demo.addNode({
        id: capability.id,
        label: capability.label,
        x: anchorPos.x + sideOffsets[i] * DEFAULT_CAPABILITY_GAP,
        y: anchorPos.y,
        draggable: false,
      });
      demo.addConnection({ from: ctx.chain.need.id, to: capability.id });
    });
  }

  const byScreenX = capabilities
    .map((capability) => ({ capability, pos: demo.getNodePosition(capability.id)! }))
    .sort((a, b) => a.pos.x - b.pos.x);

  byScreenX.forEach(({ capability }, i) => {
    ctx.chain = relabelCapability(ctx.chain, capability.id, PART_LABELS[i]);
    demo.relabelNode(capability.id, PART_LABELS[i]);
  });

  const right = byScreenX[2].capability;
  const rightPos = demo.getNodePixelPosition(right.id);
  if (rightPos) mascot.moveTo(right.id, rightPos);

  mascot.showPlaceholder(MASCOT_MULTIPLE_PARTS.heading, MASCOT_MULTIPLE_PARTS.subheading);
  await mascot.confirmPlacement("Next");
}
