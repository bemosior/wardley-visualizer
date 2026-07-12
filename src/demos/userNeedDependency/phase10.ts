import { relabelCapability, relabelNeed, relabelUser } from "../../domain/valueChain";
import { NEED_CATALOG } from "../../domain/needCatalog";
import type { ScenarioContext } from "./index";

const MASCOT_CHAIN_COMPLETE = "Value Chain done! Now let's turn this into a Wardley Map.";

/**
 * Phase 10: personalize the value chain. Starts right after Phase 5's own "Next" gate
 * (`phase5.ts`, the Part A/B/C explanation), walking the visitor through a 5-step form
 * (`Mascot.showField`: user -> need -> 3 capabilities), re-anchoring to whichever node each
 * question is about before asking it, relabeling each placeholder node (both the domain
 * `ValueChain` in `ctx.chain` and the rendered canvas node) as its answer comes in. Once
 * personalized, shows an "All done!" placeholder and the chain celebrates, firing `onCelebrate` —
 * the caller then waits on a "Next" link that gates the move into Phase 20 (`phase20.ts`).
 */
export async function runPhase10(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, options } = ctx;

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos);
  const userLabel = await mascot.showField(
    {
      type: "choice",
      prompt: "Who should we help today?",
      // several NEED_CATALOG entries deliberately share a user (that user's other needs) --
      // dedupe so each user gets exactly one pill, not one per need they have.
      options: [...new Set(NEED_CATALOG.map((need) => need.user))],
    },
    "Pick a user to help below. ↓",
  );
  ctx.chain = relabelUser(ctx.chain, userLabel);
  demo.relabelNode(ctx.chain.user.id, ctx.chain.user.label);

  // narrow the "what does X need?" pills to needs catalogued for that user. Since userLabel is
  // now always an exact NEED_CATALOG value (a pill choice, not free text), this always matches --
  // the full-catalog fallback below is defensive dead code, left in case that ever changes.
  const matchingUserNeeds = NEED_CATALOG.filter(
    (need) => need.user.toLowerCase() === userLabel.trim().toLowerCase(),
  );
  const relevantNeeds = matchingUserNeeds.length ? matchingUserNeeds : NEED_CATALOG;

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos);
  const needLabel = await mascot.showField(
    {
      type: "choice",
      prompt: "What does " + userLabel + " need?",
      options: relevantNeeds.map((need) => need.label),
    },
    "Pick their user need below. ↓",
  );
  ctx.chain = relabelNeed(ctx.chain, needLabel);
  demo.relabelNode(ctx.chain.need.id, ctx.chain.need.label);

  // best-effort match against the catalog, used to pick fitting capability pills for the steps
  // below; falls back to the first catalog need if the visitor typed something custom, so the
  // pill list is never empty
  const needOption =
    NEED_CATALOG.find((need) => need.label.toLowerCase() === needLabel.trim().toLowerCase()) ?? NEED_CATALOG[0];

  // walk capabilities left-to-right by their rendered screen position, not by domain id order --
  // a host config (e.g. `preview.html`) can pre-render one capability off-center, and Phase 5
  // fills the remaining slots around it (`phase5.ts`), so array order doesn't always match
  // screen order.
  const capabilitiesByScreenX = ctx.chain.capabilities
    .map((capability) => ({ capability, pos: demo.getNodePosition(capability.id) }))
    .sort((a, b) => (a.pos?.x ?? 0) - (b.pos?.x ?? 0))
    .map(({ capability }) => capability);

  const capabilityCount = capabilitiesByScreenX.length;
  const usedCapabilityLabels = new Set<string>();

  // stays anchored beside the Need node for all `capabilityCount` sub-questions, rather than
  // re-anchoring beside each Capability node in turn. This used to be load-bearing: the old
  // floating speech bubble grew wide enough (up to 10 catalog example chips) to bridge clean
  // across into Need's own column if anchored above any individual Capability. Now that the actual
  // question content renders in the permanent dialog panel below the canvas (not a bubble beside
  // the avatar), that constraint no longer applies -- anchoring the avatar per-Capability instead
  // would be a viable, arguably nicer content choice, just not one this pass makes.
  const needPosForCapabilities = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPosForCapabilities) mascot.moveTo(ctx.chain.need.id, needPosForCapabilities);

  for (let i = 0; i < capabilityCount; i++) {
    const capability = capabilitiesByScreenX[i];
    // offer every capability option as a pill, minus any already picked in an earlier slot so
    // the same option isn't offered twice
    const remainingCapabilities = needOption.capabilityOptions.filter(
      (label) => !usedCapabilityLabels.has(label.toLowerCase()),
    );
    const capabilityLabel = await mascot.showField(
      {
        type: "choice",
        prompt: `What's something ${i > 0 ? "else " : ""}they depend on to get their "${needLabel}" need met? \r\n(${i + 1} of ${capabilityCount})`,
        options: remainingCapabilities,
      },
      "Pick three capabilities below. ↓",
    );
    usedCapabilityLabels.add(capabilityLabel.trim().toLowerCase());
    ctx.chain = relabelCapability(ctx.chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }
  
  mascot.say(MASCOT_CHAIN_COMPLETE);
  demo.celebrateAll();
  options.onCelebrate?.();
}
