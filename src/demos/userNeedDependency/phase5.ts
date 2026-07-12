import { relabelCapability } from "../../domain/valueChain";
import { DEFAULT_CAPABILITY_GAP, type Point } from "../../application/valueChainLayout";
import type { ScenarioContext } from "./index";

const MASCOT_USER = "This is a User. In a value chain, it's who we choose to help.";

const MASCOT_USER_NEED = "This is a User Need. It's what the user expects to get.";

const MASCOT_CAPABILITY = "This is a Capability. It's how we meet the user need.";

/** placeholder labels for the three Capability nodes while this phase explains their number,
 * before Phase 10's form overwrites them with the visitor's own answers. Assigned left-to-right
 * by final screen position, not domain id order — see the sort in `runPhase5` below. */
const PART_LABELS = ["Part A", "Part B", "Part C"];

const MASCOT_MULTIPLE_PARTS_INTRO = "A Value Chain is like a recipe.";
const MASCOT_MULTIPLE_PARTS_DETAIL =
  "It often takes multiple capabilities to come together to meet the user need.";

/**
 * an open patch of canvas whitespace to the right of the whole value chain, in viewBox
 * coordinates — not anchored to any node, same technique as `phase7.ts`'s own step-back point (see
 * its doc comment), just to the side instead of below. Derived from the chain's own actual node
 * positions (the User row and the rightmost Capability slot) rather than a hardcoded
 * default-layout constant, so it stays clear of the row regardless of `layout`/`config` overrides:
 * `x` clears the rightmost Capability's circle by a full `DEFAULT_CAPABILITY_GAP` (the same rhythm
 * the row's own nodes are spaced at), clamped to the viewBox's own right edge so it never lands
 * off-canvas; `y` sits vertically centered between the User row and the Capability row, so the
 * avatar reads as beside the whole chain rather than level with any one row of it. Takes the
 * rightmost Capability's *position* rather than its node id so a caller can compute this before
 * that node actually exists on screen (`runPhase5` calls this using the still-missing Capability
 * row's eventual final positions, so the mascot is already waiting in its resting spot before
 * those nodes fade in, instead of anchoring beside a row that's about to change shape under it).
 */
function rightOfChainPoint(ctx: ScenarioContext, rightmostCapabilityPos: Point): { x: number; y: number } {
  const { demo, chain } = ctx;
  const viewBox = demo.getViewBoxSize();
  const userPos = demo.getNodePosition(chain.user.id)!;
  return {
    x: Math.min(viewBox.width, rightmostCapabilityPos.x + DEFAULT_CAPABILITY_GAP),
    y: (userPos.y + rightmostCapabilityPos.y) / 2,
  };
}

/**
 * Phase 5: between Phase 0 (drag the Need into place) and Phase 10 (personalize via the form).
 * Starts right where `phase0.ts` leaves off (its own "You made a Value Chain!" caption already
 * shown and confirmed there), walking the visitor through the chain node by node instead of
 * summarizing it all in one beat: re-anchoring the mascot's avatar to the User node ("This is a
 * user."), then the Need ("This is a user need."), then a single Capability node ("This is a
 * capability."), each a short caption gated behind its own "Next" — before the recipe beat below
 * generalizes from that one capability to "the recipe often calls for many parts", the row itself
 * growing to three mid-explanation rather than all at once up front.
 *
 * For the Capability stop, Phase 0's config is allowed to render only *one* Capability node (e.g.
 * `preview.html`'s hand-tuned host-embed config, which deliberately shows a single "How their need
 * gets met" node to keep the opening puzzle simple) — so this phase anchors to whichever Capability
 * node is already registered (`demo.hasNode`) for that single-capability beat.
 *
 * With still just that one Capability on screen, steps the mascot's avatar back into open canvas
 * whitespace to the right of the whole chain (`rightOfChainPoint`/`Mascot.moveToViewBoxPoint`, the
 * same node-independent technique Phase 7 uses to step back for its own introduction -- computed
 * from where the *eventual* three-Capability row will end up, not just the one node currently
 * there, so the mascot doesn't have to jump again once the row fills in) and says the recipe line
 * ("A Value Chain is like a recipe.") while the chain still shows only one Capability. *Only on the
 * next "Next"* does it relabel all three Capabilities "Part A"/"Part B"/"Part C" *by final
 * left-to-right screen position* (not by domain id order, since a host config's pre-existing node
 * isn't necessarily `dependency-1`) and reuses that one node's position to add whichever of the
 * three aren't already there -- already labeled with their own final Part name, not the generic
 * placeholder, so a newly-added node never briefly shows the wrong label -- spreading any missing
 * ones into the empty slots on either side (that node becomes the row's visual center —
 * `DEFAULT_CAPABILITY_GAP` on either side, same spacing `valueChainLayout.ts` uses when it renders
 * all three from the start), fading each new node in (`demo.addNode`'s `animateIn` option) rather
 * than having it pop straight into existence beside the one that's already there, and connecting
 * each new node to the Need (nothing to do here for `index.html`'s default layout, which already
 * renders all three from Phase 0 — the "missing" list is just empty) — then says the second half of
 * the beat ("It often takes multiple capabilities to come together...", split into its own caption
 * since together the two would exceed `Mascot.say`'s char guard) once the full row is visible and
 * already named, so the visitor sees the row grow to three Parts at once, right as they hear why,
 * rather than watching it grow under a stale placeholder label first. Waits for a final "Next" gate
 * before returning, so the caller (`phase10.ts`) can start directly with "What does the user need?"
 * instead of also showing its own opening caption.
 */
export async function runPhase5(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot } = ctx;

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos);
  mascot.say(MASCOT_USER);
  await mascot.confirmPlacement("Next");

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos);
  mascot.say(MASCOT_USER_NEED);
  await mascot.confirmPlacement("Next");

  const capabilities = ctx.chain.capabilities;
  const anchor = capabilities.find((capability) => demo.hasNode(capability.id))!;
  const anchorPixelPos = demo.getNodePixelPosition(anchor.id);
  if (anchorPixelPos) mascot.moveTo(anchor.id, anchorPixelPos);
  mascot.say(MASCOT_CAPABILITY);
  await mascot.confirmPlacement("Next");

  const missing = capabilities.filter((capability) => !demo.hasNode(capability.id));
  const anchorPos = demo.getNodePosition(anchor.id)!;
  const sideOffsets = [-1, 1]; // left/right slots around the already-rendered node

  // final left-to-right screen positions for all three Capability nodes, including whichever
  // aren't rendered yet -- lets the mascot step into whitespace clear of the eventual full row
  // before those still-missing nodes actually appear, and lets the relabel step below sort by
  // final position without re-querying the DOM.
  const finalPositions = new Map<string, Point>();
  capabilities.forEach((capability) => {
    const pos = demo.getNodePosition(capability.id);
    if (pos) finalPositions.set(capability.id, pos);
  });
  missing.forEach((capability, i) => {
    finalPositions.set(capability.id, { x: anchorPos.x + sideOffsets[i] * DEFAULT_CAPABILITY_GAP, y: anchorPos.y });
  });
  const byScreenX = capabilities
    .map((capability) => ({ capability, pos: finalPositions.get(capability.id)! }))
    .sort((a, b) => a.pos.x - b.pos.x);
  const partLabels = new Map(byScreenX.map(({ capability }, i) => [capability.id, PART_LABELS[i]]));

  const { x, y } = rightOfChainPoint(ctx, byScreenX[2].pos);
  mascot.moveToViewBoxPoint(x, y);
  mascot.say(MASCOT_MULTIPLE_PARTS_INTRO);
  await mascot.confirmPlacement("Next");

  byScreenX.forEach(({ capability }) => {
    const label = partLabels.get(capability.id)!;
    ctx.chain = relabelCapability(ctx.chain, capability.id, label);
    // already-rendered nodes (the anchor, and -- for a config that renders all three from the
    // start -- its siblings too) get relabeled directly; still-missing ones get their final Part
    // label baked into `addNode` below instead, so they never briefly show the generic placeholder
    if (demo.hasNode(capability.id)) demo.relabelNode(capability.id, label);
  });
  missing.forEach((capability, i) => {
    demo.addNode(
      {
        id: capability.id,
        label: partLabels.get(capability.id)!,
        x: anchorPos.x + sideOffsets[i] * DEFAULT_CAPABILITY_GAP,
        y: anchorPos.y,
        draggable: false,
      },
      { animateIn: true },
    );
    demo.addConnection({ from: ctx.chain.need.id, to: capability.id });
  });
  mascot.say(MASCOT_MULTIPLE_PARTS_DETAIL);
  await mascot.confirmPlacement("Next");
}
