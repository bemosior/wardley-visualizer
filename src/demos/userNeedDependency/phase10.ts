import { relabelCapability, relabelNeed, relabelUser } from "../../domain/valueChain";
import { NEED_CATALOG } from "../../domain/needCatalog";
import type { ScenarioContext } from "./index";

/** the mascot's Phase 10 bubble copy, shown at the Phase 0 -> Phase 10 "waiting for Next" pause.
 * Doubles as the "what's a Value Chain?" payoff that used to live in the host page's separate
 * `.wd-explanation` column (`#vc-answer`) — now the bubble is the only place that copy lives. */
const MASCOT_NEED_PLACED = {
  heading: "You just made a Value Chain!",
  subheading:
    "A value chain is a picture that tells us who needs what, and how they get it.",
};
const MASCOT_CHAIN_COMPLETE = { heading: "All done!", subheading: "Click Next to turn this into a Wardley Map." };

/**
 * Phase 10: personalize the value chain. Shows the "That's a Value Chain!" placeholder while the
 * visitor clicks the "Next" link (the Phase 0 -> Phase 10 gate), rendered inside the mascot's own
 * bubble via `Mascot.confirmPlacement` rather than a host-page element, then walks the visitor
 * through a 5-step form (`Mascot.showField`: need -> user -> 3 capabilities), re-anchoring to
 * whichever node each question is about before asking it, relabeling each placeholder node (both
 * the domain `ValueChain` in `ctx.chain` and the rendered canvas node) as its answer comes in.
 * Once personalized, shows an "All done!" placeholder and the chain celebrates, firing
 * `onCelebrate` — the caller then waits on a second "Next" link that gates the move into Phase 20
 * (`phase20.ts`).
 */
export async function runPhase10(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, options } = ctx;

  mascot.showPlaceholder(MASCOT_NEED_PLACED.heading, MASCOT_NEED_PLACED.subheading);
  await mascot.confirmPlacement("Next");

  const needPos = demo.getNodePixelPosition(ctx.chain.need.id);
  if (needPos) mascot.moveTo(ctx.chain.need.id, needPos);
  const needId = await mascot.showField({
    type: "select",
    prompt: "What does the user need?",
    options: NEED_CATALOG.map((need) => ({ value: need.id, label: need.label })),
  });
  const needOption = NEED_CATALOG.find((need) => need.id === needId)!;
  ctx.chain = relabelNeed(ctx.chain, needOption.label);
  demo.relabelNode(ctx.chain.need.id, ctx.chain.need.label);

  const userPos = demo.getNodePixelPosition(ctx.chain.user.id);
  if (userPos) mascot.moveTo(ctx.chain.user.id, userPos);
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
