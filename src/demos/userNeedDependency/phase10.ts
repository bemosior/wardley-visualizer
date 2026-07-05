import { relabelCapability, relabelNeed, relabelUser } from "../../domain/valueChain";
import { NEED_CATALOG } from "../../domain/needCatalog";
import type { ScenarioContext } from "./index";

const MASCOT_CHAIN_COMPLETE = { heading: "All done!", subheading: "Click Next to turn this into a Wardley Map." };

/**
 * Phase 10: personalize the value chain. Starts right after Phase 5's own "Next" gate
 * (`phase5.ts`, the Part A/B/C explanation), walking the visitor through a 5-step form
 * (`Mascot.showField`: need -> user -> 3 capabilities), re-anchoring to whichever node each
 * question is about before asking it, relabeling each placeholder node (both the domain
 * `ValueChain` in `ctx.chain` and the rendered canvas node) as its answer comes in. Once
 * personalized, shows an "All done!" placeholder and the chain celebrates, firing `onCelebrate` —
 * the caller then waits on a "Next" link that gates the move into Phase 20 (`phase20.ts`).
 */
export async function runPhase10(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, options } = ctx;

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos, "northeast");
  const needId = await mascot.showField({
    type: "select",
    prompt: "What does the user need?",
    options: NEED_CATALOG.map((need) => ({ value: need.id, label: need.label })),
  });
  const needOption = NEED_CATALOG.find((need) => need.id === needId)!;
  ctx.chain = relabelNeed(ctx.chain, needOption.label);
  demo.relabelNode(ctx.chain.need.id, ctx.chain.need.label);

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos, "northeast");
  const userLabel = await mascot.showField({
    type: "text",
    prompt: "Who needs " + needOption.label + "?",
    placeholder: needOption.userPlaceholder,
  });
  ctx.chain = relabelUser(ctx.chain, userLabel);
  demo.relabelNode(ctx.chain.user.id, ctx.chain.user.label);

  const capabilityCount = ctx.chain.capabilities.length;
  for (let i = 0; i < capabilityCount; i++) {
    const capability = ctx.chain.capabilities[i];
    const capabilityPos = demo.getNodePixelPosition(capability.id);
    if (capabilityPos) mascot.moveTo(capability.id, capabilityPos);
    const capabilityLabel = await mascot.showField({
      type: "text",
      prompt: `What's something they depend on to get this need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: needOption.capabilityPlaceholders[i],
    });
    ctx.chain = relabelCapability(ctx.chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }

  mascot.showPlaceholder(MASCOT_CHAIN_COMPLETE.heading, MASCOT_CHAIN_COMPLETE.subheading);
  demo.celebrateAll();
  options.onCelebrate?.();
}
