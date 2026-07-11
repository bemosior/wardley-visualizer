import { relabelCapability, relabelNeed, relabelUser } from "../../domain/valueChain";
import { NEED_CATALOG } from "../../domain/needCatalog";
import type { ScenarioContext } from "./index";

const MASCOT_CHAIN_COMPLETE = { heading: "Value Chain done!", subheading: "Now let's turn this into a Wardley Map." };

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
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos, "northeast");
  const userLabel = await mascot.showField({
    type: "choice",
    prompt: "Who should we help today?",
    // several NEED_CATALOG entries deliberately share a user (that user's other needs) --
    // dedupe so each user gets exactly one pill, not one per need they have.
    options: [...new Set(NEED_CATALOG.map((need) => need.user))],
  });
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
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos, "northeast");
  const needLabel = await mascot.showField({
    type: "choice",
    prompt: "What does " + userLabel + " need?",
    options: relevantNeeds.map((need) => need.label),
  });
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

  // stays anchored beside the Need node (the same "northeast" spot the question above already
  // used) for all `capabilityCount` sub-questions, rather than re-anchoring beside each Capability
  // node in turn (this used to be "south"). Each capability's example list runs up to 10 catalog
  // options (`needCatalog.ts`), which makes for a bubble far wider than the ~140px gap between
  // adjacent Capability nodes -- anchoring "above" any one of them, even an outer one, bridges
  // clean across into the Need node's own column and hides it behind the bubble (tried and
  // measured live: the bubble ends up wide enough to fully cover Need regardless of which
  // Capability it's meant to hover above). "South" avoided that by never going above at all, but
  // forced the bubble below the bottom-most row on the page, tall enough with 10 examples to push
  // the page's height past the viewport and force a jarring auto-scroll on every capability.
  // Staying at Need's already-safe, already-visible spot avoids both: nothing forces the page to
  // grow, and nothing sits low enough to need scrolling into view.
  const needPosForCapabilities = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPosForCapabilities) mascot.moveTo(ctx.chain.need.id, needPosForCapabilities, "northeast");

  for (let i = 0; i < capabilityCount; i++) {
    const capability = capabilitiesByScreenX[i];
    // offer every capability option as a pill, minus any already picked in an earlier slot so
    // the same option isn't offered twice
    const remainingCapabilities = needOption.capabilityOptions.filter(
      (label) => !usedCapabilityLabels.has(label.toLowerCase()),
    );
    const capabilityLabel = await mascot.showField({
      type: "text",
      prompt: `What's something ${i > 0 ? "else " : ""}they depend on to get the user need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: "Write your own",
      examples: remainingCapabilities,
    });
    usedCapabilityLabels.add(capabilityLabel.trim().toLowerCase());
    ctx.chain = relabelCapability(ctx.chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }
  
  mascot.moveToTopRight();
  mascot.showPlaceholder(MASCOT_CHAIN_COMPLETE.heading, MASCOT_CHAIN_COMPLETE.subheading);
  demo.celebrateAll();
  options.onCelebrate?.();
}
