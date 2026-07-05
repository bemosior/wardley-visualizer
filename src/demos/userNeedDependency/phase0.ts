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

/** the mascot's Phase 0 bubble copy, shown before the first drag */
const MASCOT_INTRO = { heading: "Solve the puzzle.", subheading: "Drag the missing piece into place." };

/**
 * Phase 0: drag the Need into place. The Need node itself renders already on the canvas, out of
 * place at its `start` position (`layoutValueChain`'s default, same row as its final spot but off
 * to one side) and pulsing (`wd-node--beckon`) to invite a direct drag — no separate toolbox slot
 * to pick up from. Mounts the sole `Mascot` guide (`engine/mascot.ts`) before `WardleyDemo` itself,
 * since the mascot renders from the very start of the scenario. The mascot anchors beside the
 * Need's *destination* marker instead — the dashed target circle at its final `layoutValueChain`
 * position (`WardleyDemo.getNodePixelPosition`), via `Mascot`'s `"east"` placement — so it points
 * at where the Need is headed rather than sitting on top of the node the visitor is about to pick
 * up. It greets the visitor (`MASCOT_INTRO`, via `Mascot.showPlaceholder`), then waits for the
 * Need to be dragged into place. Once it snaps, the mascot re-anchors to the Need's settled
 * position (`"northeast"`, clear of the Capability row underneath) and fires `onNeedPlaced`
 * (Phase 0 done) — the caller then shows the "That's a Value Chain!" placeholder and a "Next" link
 * (see `phase10.ts`).
 */
export async function runPhase0(options: ValueChainScenarioOptions): Promise<ScenarioContext> {
  const chain = seedValueChain;
  const demoConfig = options.config ?? layoutValueChain(chain, options.layout);

  const mascot = new Mascot(options.mascotHost);
  mascot.mount();
  mascot.showPlaceholder(MASCOT_INTRO.heading, MASCOT_INTRO.subheading);

  let demo!: WardleyDemo;
  await new Promise<void>((resolve) => {
    demo = WardleyDemo.mount(options.canvas, { ...demoConfig, onComplete: resolve });
    // grows the viewBox to fill the container right away, so the canvas is already the same size
    // it'll be in Phase 20 (see `growToFillContainer`'s doc comment) instead of visibly widening
    // later at the Phase 20 transition.
    demo.growToFillContainer(PANEL_CONTENT_MIN_HEIGHT);
    const needDestination = demo.getNodePixelPosition(chain.need.id);
    // anchors beside the Need's *destination* marker (the dashed target circle), not its
    // out-of-place `start` position -- keeps the mascot clear of the node the visitor is about
    // to pick up and drag, and points at where it's headed instead.
    if (needDestination) mascot.moveTo(chain.need.id, needDestination, "east");
    options.onMount?.(demo);
  });

  mascot.attachDemo(demo);
  const needPlacedPos = demo.getNodePixelPosition(chain.need.id);
  if (needPlacedPos) mascot.moveTo(chain.need.id, needPlacedPos, "northeast");

  options.onNeedPlaced?.();

  return { demo, mascot, chain, options };
}
