import { WardleyDemo } from "../../engine/WardleyDemo";
import { Mascot } from "../../engine/mascot";
import { createValueChain } from "../../domain/valueChain";
import { layoutValueChain } from "../../application/valueChainLayout";
import { PANEL_CONTENT_MIN_HEIGHT } from "../../engine/styles";
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

/** the mascot's one-button gate shown right after the Need snaps into place — a rhetorical hype
 * beat, not a real fork, so it offers only a single option ("Let's begin!"), no "No" path */
const MASCOT_BEGIN_GATE = { prompt: "Want to learn about Wardley Mapping?", options: [{ id: "begin", label: "Let's begin!" }] };

/** the mascot's Phase 0 -> Phase 5 "waiting for Next" pause, once labels are revealed. Carries the
 * "what's a Value Chain?" payoff (a one-shot "it's a recipe" summary); the User/Need/Capability
 * walkthrough that explains the chain piece-by-piece continues from here in `phase5.ts`. */
const MASCOT_NEED_PLACED = {
  heading: "You made a Value Chain!",
  subheading: "A value chain is a recipe for delivering value.",
};

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
 * and *only then* does the `Mascot` mount for the first time — anchored beside the Need's settled
 * position (`"northeast"`, clear of the Capability row underneath). It shows a single-CTA gate
 * (`MASCOT_BEGIN_GATE`, "Want to learn about Wardley Mapping?" / "Let's begin!") before revealing
 * every node's label (`WardleyDemo.revealNodeLabels`) and explaining what was just built
 * (`MASCOT_NEED_PLACED`) behind its own "Next" gate — the caller (`phase5.ts`) then starts directly
 * with the User/Need/Capability walkthrough.
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
    demo.growToFillContainer(PANEL_CONTENT_MIN_HEIGHT);
    arrow = demo.addDirectionalArrow(needStart, needTarget);
    options.onMount?.(demo);
  });

  arrow.remove();
  options.onNeedPlaced?.();

  const mascot = new Mascot(options.mascotHost);
  mascot.mount();
  mascot.attachDemo(demo);
  const needPlacedPos = demo.getNodePixelPosition(chain.need.id);
  if (needPlacedPos) mascot.moveTo(chain.need.id, needPlacedPos, "northeast");

  await mascot.showGate(MASCOT_BEGIN_GATE.prompt, "", MASCOT_BEGIN_GATE.options);

  demo.revealNodeLabels();
  mascot.showPlaceholder(MASCOT_NEED_PLACED.heading, MASCOT_NEED_PLACED.subheading);
  await mascot.confirmPlacement("Next");

  return { demo, mascot, chain, options };
}
