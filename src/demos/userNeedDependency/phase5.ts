import { relabelCapability } from "../../domain/valueChain";
import { DEFAULT_CAPABILITY_GAP } from "../../application/valueChainLayout";
import type { ScenarioContext } from "./index";

const MASCOT_USER = {
  heading: "This is a User.",
  subheading: "In a value chain, it's who we choose to help.",
};

const MASCOT_USER_NEED = {
  heading: "This is a User Need.",
  subheading: "It's what the user expects to get.",
};

const MASCOT_CAPABILITY = {
  heading: "This is a Capability.",
  subheading: "It's how we meet the user need.",
};

/** placeholder labels for the three Capability nodes while this phase explains their number,
 * before Phase 10's form overwrites them with the visitor's own answers. Assigned left-to-right
 * by final screen position, not domain id order — see the sort in `runPhase5` below. */
const PART_LABELS = ["Part A", "Part B", "Part C"];

const MASCOT_MULTIPLE_PARTS = {
  heading: "A Value Chain is like a recipe.",
  subheading: "It often takes multiple capabilities to come together to meet the user need.",
};

/**
 * Phase 5: between Phase 0 (drag the Need into place) and Phase 10 (personalize via the form).
 * Starts right where `phase0.ts` leaves off (its own "You made a Value Chain!" caption already
 * shown and confirmed there), walking the visitor through the chain node by node instead of
 * summarizing it all in one beat: re-anchoring the mascot's avatar to the User node ("This is a
 * user."), then the Need ("This is a user need."), then a single Capability node ("This is a
 * capability."), each a short caption gated behind its own "Next" — before the Part A/B/C beat
 * below generalizes from that one capability to "the recipe often calls for many parts" (long
 * enough to need two captions in a row instead of one).
 *
 * For the Capability stop, Phase 0's config is allowed to render only *one* Capability node (e.g.
 * `preview.html`'s hand-tuned host-embed config, which deliberately shows a single "How their need
 * gets met" node to keep the opening puzzle simple) — so this phase anchors to whichever Capability
 * node is already registered (`demo.hasNode`) for that single-capability beat, then reuses the same
 * node's position afterward to add whichever of the three Capability nodes aren't already there,
 * spreading any missing ones into the empty slots on either side (that node becomes the row's
 * visual center — `DEFAULT_CAPABILITY_GAP` on either side, same spacing `valueChainLayout.ts` uses
 * when it renders all three from the start), fading each new node in (`demo.addNode`'s `animateIn`
 * option) rather than having it pop straight into existence beside the one that's already there,
 * and connects each new node to the Need (nothing to do here for `index.html`'s default layout,
 * which already renders all three from Phase 0 — the "missing" list is just empty).
 *
 * Once all three exist, relabels them "Part A"/"Part B"/"Part C" *by final left-to-right screen
 * position* (not by domain id order, since a host config's pre-existing node isn't necessarily
 * `dependency-1`), re-anchors the mascot's avatar to the rightmost of the sorted row, and explains
 * (two captions in a row -- this one runs long enough that a single caption would exceed
 * `Mascot.say`'s char guard) that a need is sometimes met by multiple parts adding up together.
 * Waits for a final "Next" gate before returning, so the caller (`phase10.ts`) can start directly
 * with "What does the user need?" instead of also showing its own opening caption.
 */
export async function runPhase5(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot } = ctx;

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos);
  mascot.say(`${MASCOT_USER.heading} ${MASCOT_USER.subheading}`);
  await mascot.confirmPlacement("Next");

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos);
  mascot.say(`${MASCOT_USER_NEED.heading} ${MASCOT_USER_NEED.subheading}`);
  await mascot.confirmPlacement("Next");

  const capabilities = ctx.chain.capabilities;
  const anchor = capabilities.find((capability) => demo.hasNode(capability.id))!;
  const anchorPixelPos = demo.getNodePixelPosition(anchor.id);
  if (anchorPixelPos) mascot.moveTo(anchor.id, anchorPixelPos);
  mascot.say(`${MASCOT_CAPABILITY.heading} ${MASCOT_CAPABILITY.subheading}`);
  await mascot.confirmPlacement("Next");

  const missing = capabilities.filter((capability) => !demo.hasNode(capability.id));
  if (missing.length > 0) {
    const anchorPos = demo.getNodePosition(anchor.id)!;
    const sideOffsets = [-1, 1]; // left/right slots around the already-rendered node
    missing.forEach((capability, i) => {
      demo.addNode(
        {
          id: capability.id,
          label: capability.label,
          x: anchorPos.x + sideOffsets[i] * DEFAULT_CAPABILITY_GAP,
          y: anchorPos.y,
          draggable: false,
        },
        { animateIn: true },
      );
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

  mascot.say(MASCOT_MULTIPLE_PARTS.heading);
  await mascot.confirmPlacement("Next");
  mascot.say(MASCOT_MULTIPLE_PARTS.subheading);
  await mascot.confirmPlacement("Next");
}
