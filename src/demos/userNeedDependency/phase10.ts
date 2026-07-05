import { relabelCapability, relabelNeed, relabelUser } from "../../domain/valueChain";
import { NEED_CATALOG } from "../../domain/needCatalog";
import type { ScenarioContext } from "./index";

const MASCOT_CHAIN_COMPLETE = { heading: "All done!", subheading: "Now let's turn this into a Wardley Map." };

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
    type: "text",
    prompt: "Who should we help today?",
    placeholder: NEED_CATALOG[0].userPlaceholder,
    examples: NEED_CATALOG.map((need) => need.userPlaceholder),
  });
  ctx.chain = relabelUser(ctx.chain, userLabel);
  demo.relabelNode(ctx.chain.user.id, ctx.chain.user.label);

  // narrow the "what does X need?" pills to needs catalogued for that user; falls back to
  // the full catalog when the visitor typed a custom user we don't recognize
  const matchingUserNeeds = NEED_CATALOG.filter(
    (need) => need.userPlaceholder.toLowerCase() === userLabel.trim().toLowerCase(),
  );
  const relevantNeeds = matchingUserNeeds.length ? matchingUserNeeds : NEED_CATALOG;

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos, "northeast");
  const needLabel = await mascot.showField({
    type: "text",
    prompt: "What does " + userLabel + " need?",
    placeholder: relevantNeeds[0].label,
    examples: relevantNeeds.map((need) => need.label),
  });
  ctx.chain = relabelNeed(ctx.chain, needLabel);
  demo.relabelNode(ctx.chain.need.id, ctx.chain.need.label);

  // best-effort match against the catalog, used to pick fitting placeholders and pills for
  // the capability steps below; falls back to the first catalog need if the visitor typed
  // something custom, so the placeholder is never empty
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
  for (let i = 0; i < capabilityCount; i++) {
    const capability = capabilitiesByScreenX[i];
    const capabilityPos = demo.getNodePixelPosition(capability.id);
    if (capabilityPos) mascot.moveTo(capability.id, capabilityPos, "south");
    // offer all three of the need's capabilities as pills (not just the one at this index),
    // minus any already picked in an earlier slot so the same option isn't offered twice
    const remainingCapabilities = needOption.capabilityPlaceholders.filter(
      (label) => !usedCapabilityLabels.has(label.toLowerCase()),
    );
    const capabilityLabel = await mascot.showField({
      type: "text",
      prompt: `What's something they depend on to get this need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: needOption.capabilityPlaceholders[i],
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
