import { relabelCapability } from "../../domain/valueChain";
import { DEFAULT_CAPABILITY_GAP } from "../../application/valueChainLayout";
import type { ScenarioContext } from "./index";

/** the mascot's Phase 0 -> Phase 5 "waiting for Next" pause. Used to also carry the "what's a
 * Value Chain?" payoff (a one-shot "it's a recipe" summary) that used to live in the host page's
 * separate `.wd-explanation` column (`#vc-answer`); that explanation is now given piece-by-piece
 * by the User/Need/Capability walkthrough below instead, so this beat is just the acknowledgment
 * that kicks the walkthrough off. */
const MASCOT_NEED_PLACED = {
  heading: "You made a Value Chain!",
  subheading: "A value chain is a recipe for delivering value.",
};

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
 * Shows the "You just made a Value Chain!" placeholder, waits for the Phase 0 -> Phase 5 "Next"
 * gate (moved here from `phase10.ts`), then walks the visitor through the chain node by node
 * instead of summarizing it all in one placeholder: re-anchoring the mascot to the User node
 * ("This is a user."), then the Need ("This is a user need."), then a single Capability node
 * ("This is a capability."), each gated behind its own "Next" — before the Part A/B/C beat below
 * generalizes from that one capability to "the recipe often calls for many parts."
 *
 * For the Capability stop, Phase 0's config is allowed to render only *one* Capability node (e.g.
 * `preview.html`'s hand-tuned host-embed config, which deliberately shows a single "How their need
 * gets met" node to keep the opening puzzle simple) — so this phase anchors to whichever Capability
 * node is already registered (`demo.hasNode`) for that single-capability beat, then reuses the same
 * node's position afterward to add whichever of the three Capability nodes aren't already there,
 * spreading any missing ones into the empty slots on either side (that node becomes the row's
 * visual center — `DEFAULT_CAPABILITY_GAP` on either side, same spacing `valueChainLayout.ts` uses
 * when it renders all three from the start), and connects each new node to the Need (nothing to do
 * here for `index.html`'s default layout, which already renders all three from Phase 0 — the
 * "missing" list is just empty).
 *
 * Once all three exist, relabels them "Part A"/"Part B"/"Part C" *by final left-to-right screen
 * position* (not by domain id order, since a host config's pre-existing node isn't necessarily
 * `dependency-1`), re-anchors the mascot below the visually-centered one (the middle of the sorted
 * row — see `[[project_wardley_demo_mascot_bubble_geometry]]` memory on why the mascot anchors
 * *below the whole row* here rather than beside one node), and explains that a need is sometimes
 * met by multiple parts adding up together. Waits for a final "Next" gate before returning, so the
 * caller (`phase10.ts`) can start directly with "What does the user need?" instead of also showing
 * the "Need placed" placeholder itself.
 */
export async function runPhase5(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot } = ctx;

  mascot.showPlaceholder(MASCOT_NEED_PLACED.heading, MASCOT_NEED_PLACED.subheading);
  await mascot.confirmPlacement("Next");

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos, "northeast");
  mascot.showPlaceholder(MASCOT_USER.heading, MASCOT_USER.subheading);
  await mascot.confirmPlacement("Next");

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos, "northeast");
  mascot.showPlaceholder(MASCOT_USER_NEED.heading, MASCOT_USER_NEED.subheading);
  await mascot.confirmPlacement("Next");

  const capabilities = ctx.chain.capabilities;
  const anchor = capabilities.find((capability) => demo.hasNode(capability.id))!;
  const anchorPixelPos = demo.getNodePixelPosition(anchor.id);
  // "south", not "northeast": this capability sits beside its side-by-side siblings, so
  // "northeast"'s rightward shift would walk the bubble straight into the next one over -- see
  // `MascotPlacement`'s doc comment.
  if (anchorPixelPos) mascot.moveTo(anchor.id, anchorPixelPos, "south");
  mascot.showPlaceholder(MASCOT_CAPABILITY.heading, MASCOT_CAPABILITY.subheading);
  await mascot.confirmPlacement("Next");

  const missing = capabilities.filter((capability) => !demo.hasNode(capability.id));
  if (missing.length > 0) {
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
