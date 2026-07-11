import type { WardleyDemo } from "../../engine/WardleyDemo";
import type { Mascot } from "../../engine/mascot";
import { PANEL_CONTENT_MIN_HEIGHT } from "../../engine/styles";
import type { ScenarioContext, ValueChainScenarioOptions } from "./index";

/**
 * wires `WardleyDemo.runEvolutionDragStep` for one node and resolves once the visitor confirms
 * its placement — shared by the Need's evolution step and the Capability-1/2/3 loop that repeats
 * the same interaction after it. The "Confirm placement" link renders inside the mascot's speech
 * bubble (`mascot.confirmPlacement`), same as every other gate in this scenario.
 */
function awaitEvolutionConfirm(
  demo: WardleyDemo,
  mascot: Mascot,
  nodeId: string,
  onEvolutionStep?: ValueChainScenarioOptions["onEvolutionStep"],
): Promise<void> {
  return new Promise<void>((resolve) => {
    const evolutionStep = demo.runEvolutionDragStep(nodeId, {
      // deliberately doesn't call mascot.moveTo here -- the mascot stays put at the node's
      // pre-drag position (set once, before this drag step starts) rather than chasing the node
      // pixel-by-pixel, which read as distracting motion during the drag itself.
      onPositionChange: (stageLabel) => {
        mascot.updateInstrumentPanel(stageLabel);
      },
      onReadyToConfirm: () => {
        mascot.confirmPlacement().then(() => {
          evolutionStep.confirm();
          resolve();
        });
      },
    });
    onEvolutionStep?.(evolutionStep);
  });
}

const MASCOT_EVOLUTION_INTRO = {
  heading: "Everything evolves.",
  subheading: "As things evolve, how you build, buy, and lead around them changes too.",
};

/**
 * Phase 20: turn the value chain into a Wardley Map. Waits for the visitor to click the second
 * "Next" link (the Phase 10 -> Phase 20 gate, rendered inside the mascot's own bubble via
 * `Mascot.confirmPlacement`), fires `onEvolutionReady`, and reveals the map backdrop -- then, once
 * the map itself is visible, shows one more mascot beat introducing the evolution axis
 * (`MASCOT_EVOLUTION_INTRO`) gated behind its own "Let's try it →", before showing the Need's
 * label, its starting evolution stage ("Genesis"), and the matching characteristics text from
 * `domain/evolution.ts` — updating live (`Mascot.updateInstrumentPanel`) and tracking the node's
 * on-screen position (`Mascot.moveTo`) as the visitor drags the Need along the evolution axis
 * (`demo.runEvolutionDragStep`). Each of these node-to-node re-anchors hides the bubble instantly
 * (`Mascot.hideBubbleInstantly`) before swapping its content, then fades it back in
 * (`Mascot.revealBubble`) once `moveTo` has actually landed at the new node -- otherwise the new
 * content would paint at the *old* anchor and only jump to the new one once the node's own slide
 * animation finishes. A "Confirm placement" link (`Mascot.confirmPlacement`, rendered inside the
 * bubble) appears the first time the Need is dropped, and resolves once clicked. The same
 * drag-confirm pattern then repeats for Capability-1/2/3 in turn (each slides into the Genesis
 * column, beckons, and gets its own bubble heading/subheading, the mascot re-anchoring to each in
 * turn), and once all four nodes are placed the scenario fires `demo.celebrateAll()` (with
 * the mascot celebrating alongside it) for the placement finale — the caller then waits on a
 * "Next" link that gates the move into Phase 25 (`phase25.ts`).
 */
export async function runPhase20(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain, options } = ctx;

  await mascot.confirmPlacement("Next");

  const scale = demo.captureScale();
  options.onEvolutionReady?.();

  demo.stopCharging([chain.user.id, chain.need.id, ...chain.capabilities.map((c) => c.id)]);
  demo.markPending(chain.capabilities.map((c) => c.id));
  demo.showMapBackdrop(scale, PANEL_CONTENT_MIN_HEIGHT);

  mascot.showPlaceholder(MASCOT_EVOLUTION_INTRO.heading, MASCOT_EVOLUTION_INTRO.subheading);
  await mascot.confirmPlacement("Let's try it →");

  // the Need's evolution panel is about to replace this placeholder while the mascot is still
  // anchored wherever Phase 10 left it -- without hiding first, that content swap paints at the
  // *old* anchor and only jumps to the Need's actual spot once the slide below finishes, reading
  // as a flash-then-teleport. `revealBubble()` (below) undoes this once the real move happens.
  mascot.hideBubbleInstantly();

  // guards every delayed mascot.moveTo below (the Need's slide, and each capability's, further
  // down): a real visitor always takes longer than these animations' own delay/duration to place
  // all four nodes, so those callbacks naturally fire long before `allPlaced` flips -- but the dev
  // autopilot (`src/dev/autopilot.ts`) can drive every confirmation through in well under that
  // time, in which case a stale callback would otherwise fire *after*
  // `mascot.moveToTopRight()` below and drag the mascot back onto the map instead of leaving it in
  // the corner.
  let allPlaced = false;
  mascot.showInstrumentPanel(chain.need.label, "need", "Genesis");
  // the map backdrop and the "Everything evolves." beat above already gave the visitor a moment
  // before this point, so the Need can settle into Genesis immediately -- no extra staggering
  // delay needed here the way an artificial reveal timer would have needed one.
  demo.slideToGenesis(chain.need.id, undefined, () => {
    if (!allPlaced) {
      const pos = demo.getNodePixelPosition(chain.need.id);
      // "pinned", not "northeast": the Need is about to drag freely along the evolution axis
      // below while the mascot stays put -- it needs the hard "never end up in the drag's path"
      // guarantee, not just the cosmetic beside-the-node lift. See `MascotPlacement`'s doc comment.
      if (pos) mascot.moveTo(chain.need.id, pos, "pinned");
    }
    // unconditional (not inside the `allPlaced` guard above): even on the autopilot's fast path,
    // where this callback's own moveTo is skipped because `mascot.moveToTopRight()` already ran,
    // the bubble must still come back -- otherwise it stays hidden from `hideBubbleInstantly()`
    // above for the rest of the scenario.
    mascot.revealBubble();
  });
  demo.beckonNode(chain.need.id);

  await awaitEvolutionConfirm(demo, mascot, chain.need.id, options.onEvolutionStep);

  for (const capability of chain.capabilities) {
    // same flash-then-teleport concern as the Need's transition above -- the mascot is still
    // anchored at the previous node until the slide below completes.
    mascot.hideBubbleInstantly();
    mascot.showInstrumentPanel(capability.label, "capability", "Genesis");
    demo.beckonNode(capability.id);
    // `slideToGenesis`'s own 700ms default animation duration means this `onComplete` can fire
    // well after the drag is confirmed -- guarded by `allPlaced` for the same reason as the Need's
    // slide above (a real visitor's own placement pace hides this; the autopilot's instant
    // confirms do not).
    demo.slideToGenesis(capability.id, undefined, () => {
      if (!allPlaced) {
        const pos = demo.getNodePixelPosition(capability.id);
        // same "pinned" reasoning as the Need's slide above -- this capability is about to drag
        // freely along the evolution axis too.
        if (pos) mascot.moveTo(capability.id, pos, "pinned");
      }
      // unconditional for the same reason as the Need's slide above.
      mascot.revealBubble();
    });
    await awaitEvolutionConfirm(demo, mascot, capability.id, options.onEvolutionStep);
  }

  allPlaced = true;
  mascot.moveToTopRight();
  mascot.showPlaceholder("You made a Wardley Map!", "");
  mascot.setState("celebrating");
  demo.celebrateAll(2);
}
