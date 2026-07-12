import { WardleyDemo } from "../../engine/WardleyDemo";
import { Mascot } from "../../engine/mascot";
import { createValueChain } from "../../domain/valueChain";
import { layoutValueChain } from "../../application/valueChainLayout";
import type { ValueChainScenarioOptions, ScenarioContext } from "./index";

const seedValueChain = createValueChain({
  user: { id: "user", label: "User" },
  need: { id: "need", label: "Need" },
  capabilities: [
    { id: "dependency-1", label: "Capability" },
    { id: "dependency-2", label: "Capability" },
    { id: "dependency-3", label: "Capability" },
  ],
});

/** the mascot's Phase 0 -> Phase 5 "waiting for Next" pause, once labels are revealed. Carries the
 * "what's a Value Chain?" payoff (a one-shot "it's a recipe" summary); the User/Need/Capability
 * walkthrough that explains the chain piece-by-piece continues from here in `phase5.ts`. */
const MASCOT_NEED_PLACED = "Oh cool! You made a Value Chain!";

/**
 * Phase 0: drag the Need into place. The Need node itself renders already on the canvas, out of
 * place at its `start` position (`layoutValueChain`'s default, same row as its final spot but off
 * to one side) and pulsing (`wd-node--beckon`) to invite a direct drag — no separate toolbox slot
 * to pick up from. There is nothing else to explain here (no mascot, no puzzle-framing copy): a
 * `createDirectionalArrow` cue (`WardleyDemo.addDirectionalArrow`) points from the Need's `start`
 * toward its destination instead, and every node's label starts hidden with zero visible fade
 * (`WardleyDemo.mount`'s `hideNodeLabels` option — not a post-mount class toggle, which would
 * animate; see `createNodeGroup`'s doc comment) so there's only one visible thing to do.
 *
 * Once the Need snaps into place, `onNeedPlaced` fires (Phase 0 done), the arrow cue is removed,
 * and *only then* does the `Mascot` mount for the first time — its avatar anchored beside the
 * Need's settled position. Before saying anything, it plays a one-time "arrival" flourish
 * (`Mascot.arrive`) — a pop-in plus the reused celebrating bounce/glow — so this first appearance
 * reads as a small reward rather than the mascot just flatly existing. It then reveals every
 * node's label (`WardleyDemo.revealNodeLabels`) and explains what was just built
 * (`MASCOT_NEED_PLACED`, one short caption) behind its own "Next" beat — the caller (`phase5.ts`)
 * then starts directly with the User/Need/Capability walkthrough.
 */
export async function runPhase0(options: ValueChainScenarioOptions): Promise<ScenarioContext> {
  const chain = seedValueChain;
  const demoConfig = options.config ?? layoutValueChain(chain, options.layout);
  const needNodeConfig = demoConfig.nodes.find((n) => n.id === chain.need.id)!;
  const needStart = needNodeConfig.start ?? { x: needNodeConfig.x, y: needNodeConfig.y };
  const needTarget = { x: needNodeConfig.x, y: needNodeConfig.y };

  let demo!: WardleyDemo;
  let arrow!: SVGGElement;
  await new Promise<void>((resolve) => {
    demo = WardleyDemo.mount(options.canvas, { ...demoConfig, onComplete: resolve }, { hideNodeLabels: true });
    // grows the viewBox to fill the container right away, so the canvas is already the same size
    // it'll be in Phase 20 (see `growToFillContainer`'s doc comment) instead of visibly widening
    // later at the Phase 20 transition.
    demo.growToFillContainer();
    arrow = demo.addDirectionalArrow(needStart, needTarget);
    options.onMount?.(demo);
  });

  arrow.remove();
  options.onNeedPlaced?.();

  const mascot = new Mascot(options.avatarHost, options.dialogHost);
  mascot.mount();
  mascot.attachDemo(demo);
  const needPlacedPos = demo.getNodePixelPosition(chain.need.id);
  if (needPlacedPos) mascot.moveTo(chain.need.id, needPlacedPos);

  demo.revealNodeLabels();
  await mascot.arrive(() => mascot.say(MASCOT_NEED_PLACED));
  await mascot.confirmPlacement("A value chain?");

  mascot.say("Yes! A value chain is a recipe for delivering value.")
  await mascot.confirmPlacement("Next");

  return { demo, mascot, chain, options };
}
