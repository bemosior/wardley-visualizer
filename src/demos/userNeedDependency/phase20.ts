import { MAP_CAPTION_FADE_MS } from "../../engine/WardleyDemo";
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

/**
 * Phase 20: turn the value chain into a Wardley Map. Waits for the visitor to click the second
 * "Next" link (the Phase 10 -> Phase 20 gate, rendered inside the mascot's own bubble via
 * `Mascot.confirmPlacement`), fires `onEvolutionReady`, then shows the map
 * backdrop and the Need's label, its starting evolution stage ("Genesis"), and the matching
 * characteristics text from `domain/evolution.ts` — updating live (`Mascot.updateInstrumentPanel`)
 * and tracking the node's on-screen position (`Mascot.moveTo`) as the visitor drags the Need along
 * the evolution axis (`demo.runEvolutionDragStep`). A "Confirm placement" link
 * (`Mascot.confirmPlacement`, rendered inside the bubble) appears the first time the Need is
 * dropped, and resolves once clicked. The same drag-confirm pattern then repeats for
 * Capability-1/2/3 in turn (each slides into the Genesis column, beckons, and gets its own bubble
 * heading/subheading, the mascot re-anchoring to each in turn), and once all four nodes are placed
 * the scenario fires `demo.celebrateAll()` (with the mascot celebrating alongside it) for the
 * placement finale — the caller then waits on a "Confirm placement"-style link that gates the move
 * into Phase 30 (`phase30.ts`).
 */
export async function runPhase20(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain, options } = ctx;

  await mascot.confirmPlacement("Next");
  const scale = demo.captureScale();
  options.onEvolutionReady?.();

  demo.stopCharging([chain.user.id, chain.need.id, ...chain.capabilities.map((c) => c.id)]);
  demo.markPending(chain.capabilities.map((c) => c.id));
  mascot.showInstrumentPanel(chain.need.label, "need", "Genesis", MAP_CAPTION_FADE_MS);
  demo.showMapBackdrop(
    scale,
    PANEL_CONTENT_MIN_HEIGHT,
    "Now let's turn your *Value Chain*\r\ninto a *Wardley Map*!",
  );
  // staggered by the same delay as the mascot bubble's fade-in (mascot.showInstrumentPanel
  // above), so the Need visibly settles into Genesis in step with the rest of Phase 20's reveal
  // rather than sliding immediately while the caption/bubble are still fading in.
  setTimeout(
    () =>
      demo.slideToGenesis(chain.need.id, undefined, () => {
        const pos = demo.getNodePixelPosition(chain.need.id);
        if (pos) mascot.moveTo(chain.need.id, pos, "northeast");
      }),
    MAP_CAPTION_FADE_MS,
  );
  demo.beckonNode(chain.need.id);

  await awaitEvolutionConfirm(demo, mascot, chain.need.id, options.onEvolutionStep);

  for (const capability of chain.capabilities) {
    mascot.showInstrumentPanel(capability.label, "capability", "Genesis");
    demo.beckonNode(capability.id);
    demo.slideToGenesis(capability.id, undefined, () => {
      const pos = demo.getNodePixelPosition(capability.id);
      if (pos) mascot.moveTo(capability.id, pos);
    });
    await awaitEvolutionConfirm(demo, mascot, capability.id, options.onEvolutionStep);
  }

  mascot.showPlaceholder("Wardley Map", "All placed!");
  mascot.setState("celebrating");
  demo.celebrateAll(2);
}
