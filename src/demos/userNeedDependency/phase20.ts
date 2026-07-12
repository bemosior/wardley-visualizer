import type { WardleyDemo } from "../../engine/WardleyDemo";
import type { Mascot } from "../../engine/mascot";
import type { ScenarioContext, ValueChainScenarioOptions } from "./index";

/**
 * wires `WardleyDemo.runEvolutionDragStep` for one node and resolves once the visitor confirms
 * its placement — shared by the Need's evolution step and the Capability-1/2/3 loop that repeats
 * the same interaction after it. The "Confirm placement" control (`mascot.confirmPlacement`)
 * renders into whichever surface is currently showing content -- here, the instrument panel's own
 * readout -- same mechanism as every other gate in this scenario.
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

const MASCOT_EVOLUTION_INTRO =
  "Everything evolves. As things evolve, they change! And that means the way we treat them should change, too.";

/**
 * Phase 20: turn the value chain into a Wardley Map. Waits for the visitor to click the "Next"
 * link (the Phase 10 -> Phase 20 gate, rendered via `Mascot.confirmPlacement`), fires
 * `onEvolutionReady`, and reveals the map backdrop -- then, once the map itself is visible, shows
 * one more mascot caption introducing the evolution axis (`MASCOT_EVOLUTION_INTRO`) gated behind
 * its own "Let's try it →", before showing the Need's label, its starting evolution stage
 * ("Genesis"), and the matching characteristics text from `domain/evolution.ts` in the dialog
 * panel -- updating live (`Mascot.updateInstrumentPanel`) as the visitor drags the Need along the
 * evolution axis (`demo.runEvolutionDragStep`), while the avatar itself tracks the node's
 * on-screen position (`Mascot.moveTo`). A "Confirm placement" control (`Mascot.confirmPlacement`)
 * appears the first time the Need is dropped, and resolves once clicked. The same drag-confirm
 * pattern then repeats for Capability-1/2/3 in turn (each slides into the Genesis column, beckons,
 * and gets its own instrument-panel heading/characteristics, the avatar re-anchoring to each in
 * turn), and once all four nodes are placed the scenario fires `demo.celebrateAll()` (with the
 * mascot celebrating alongside it) for the placement finale — the caller then waits on a "Next"
 * link that gates the move into Phase 25 (`phase25.ts`).
 */
export async function runPhase20(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain, options } = ctx;

  await mascot.confirmPlacement("Next");

  const scale = demo.captureScale();
  options.onEvolutionReady?.();

  demo.stopCharging([chain.user.id, chain.need.id, ...chain.capabilities.map((c) => c.id)]);
  demo.markPending(chain.capabilities.map((c) => c.id));
  demo.showMapBackdrop(scale);

  mascot.say(MASCOT_EVOLUTION_INTRO);
  await mascot.confirmPlacement("Let's try it →");

  // guards every delayed mascot.moveTo below (the Need's slide, and each capability's, further
  // down): a real visitor always takes longer than these animations' own delay/duration to place
  // all four nodes, so those callbacks naturally fire long before `allPlaced` flips -- but the dev
  // autopilot (`src/dev/autopilot.ts`) can drive every confirmation through in well under that
  // time, in which case a stale callback would otherwise fire after the placement finale below and
  // drag the avatar back onto the map instead of leaving it at its last spot.
  let allPlaced = false;
  mascot.showInstrumentPanel(chain.need.label, "need", "Genesis");
  // the map backdrop and the "Everything evolves." beat above already gave the visitor a moment
  // before this point, so the Need can settle into Genesis immediately -- no extra staggering
  // delay needed here the way an artificial reveal timer would have needed one.
  demo.slideToGenesis(chain.need.id, undefined, () => {
    if (!allPlaced) {
      const pos = demo.getNodePixelPosition(chain.need.id);
      // the Need is about to drag freely along the evolution axis below while the avatar stays
      // put, tracking its pre-drag position rather than chasing it pixel-by-pixel.
      if (pos) mascot.moveTo(chain.need.id, pos);
    }
  });
  demo.beckonNode(chain.need.id);

  await awaitEvolutionConfirm(demo, mascot, chain.need.id, options.onEvolutionStep);

  for (const capability of chain.capabilities) {
    mascot.showInstrumentPanel(capability.label, "capability", "Genesis");
    demo.beckonNode(capability.id);
    // `slideToGenesis`'s own 700ms default animation duration means this `onComplete` can fire
    // well after the drag is confirmed -- guarded by `allPlaced` for the same reason as the Need's
    // slide above (a real visitor's own placement pace hides this; the autopilot's instant
    // confirms do not).
    demo.slideToGenesis(capability.id, undefined, () => {
      if (!allPlaced) {
        const pos = demo.getNodePixelPosition(capability.id);
        if (pos) mascot.moveTo(capability.id, pos);
      }
    });
    await awaitEvolutionConfirm(demo, mascot, capability.id, options.onEvolutionStep);
  }

  allPlaced = true;
  mascot.say("You made a Wardley Map!");
  mascot.setState("celebrating");
  demo.celebrateAll(2);
}
