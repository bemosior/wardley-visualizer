import { WardleyDemo, MAP_CAPTION_FADE_MS } from "../engine/WardleyDemo";
import { Panel, type PanelDragSlot } from "../engine/panel";
import { showNextLink } from "../engine/nextLink";
import { createValueChain, relabelCapability, relabelNeed, relabelUser } from "../domain/valueChain";
import { layoutValueChain, type ValueChainLayoutOptions } from "../application/valueChainLayout";
import { NEED_CATALOG } from "../domain/needCatalog";
import type { EvolutionStage } from "../domain/evolution";
import type { DemoConfig } from "../engine/types";

const seedValueChain = createValueChain({
  user: { id: "user", label: "User" },
  need: { id: "need", label: "Need" },
  capabilities: [
    { id: "dependency-1", label: "Capability" },
    { id: "dependency-2", label: "Capability" },
    { id: "dependency-3", label: "Capability" },
  ],
});

/**
 * wires `WardleyDemo.runEvolutionDragStep` for one node and resolves once the visitor confirms
 * its placement — shared by the Need's evolution step and the Capability-1/2/3 loop that repeats
 * the same interaction after it. The "Confirm placement" link renders inside the Toolbox
 * (`panel.confirmPlacement`), not the host's `nextControl`, since it's hidden during Phase 2.
 */
function awaitEvolutionConfirm(
  demo: WardleyDemo,
  panel: Panel,
  nodeId: string,
  onEvolutionStep?: ValueChainScenarioOptions["onEvolutionStep"],
): Promise<void> {
  return new Promise<void>((resolve) => {
    const evolutionStep = demo.runEvolutionDragStep(nodeId, {
      onPositionChange: (stageLabel) => panel.updateInstrumentPanel(stageLabel as EvolutionStage),
      onReadyToConfirm: () => {
        panel.confirmPlacement().then(() => {
          evolutionStep.confirm();
          resolve();
        });
      },
    });
    onEvolutionStep?.(evolutionStep);
  });
}

const PANEL_SLOTS: PanelDragSlot[] = [
  { id: "user", iconText: "User", label: "Who It's For", active: false },
  { id: "need", iconText: "User Need", label: "What They Get", active: true },
  { id: "capability", iconText: "Capability", label: "How They Get It", active: false },
];

export interface ValueChainScenarioOptions {
  canvas: HTMLElement;
  toolbox: HTMLElement;
  /**
   * host-supplied container for the "Next" link — reused for two gates in
   * sequence: first to switch from Phase 0 into the Phase 1 form, then again
   * after the Phase 1 celebration to switch into Phase 2. Typically placed
   * beneath the host's own explanation text, not inside the Toolbox.
   */
  nextControl: HTMLElement;
  /** fires as soon as the Need snaps into place (Phase 0 done); the scenario then shows a "Next" link in `nextControl` and waits for the visitor to click it before switching the Toolbox into the Phase 1 form */
  onNeedPlaced?: () => void;
  onCelebrate?: () => void;
  /** fires right after the canvas mounts, before the drag step resolves — lets a caller grab the `WardleyDemo` instance early enough to call `skipDrag()` (see `src/dev/autopilot.ts`) */
  onMount?: (demo: WardleyDemo) => void;
  /** fires once the visitor clicks the second "Next" link (shown in `nextControl` after the celebration) — the signal that Phase 2 starts */
  onEvolutionReady?: () => void;
  /** fires once the visitor clicks "What's next →" at the very end of Phase 2, after all nodes are placed on the evolution axis and the finale celebration runs */
  onComplete?: () => void;
  /** called with each EvolutionDragHandle as Phase 2 drag steps begin — lets autopilot call skipDrag() to bypass real pointer events */
  onEvolutionStep?: (handle: import("../engine/WardleyDemo").EvolutionDragHandle) => void;
  /** override the generated layout's geometry; ignored if `config` is supplied */
  layout?: ValueChainLayoutOptions;
  /**
   * supply a fully custom DemoConfig (e.g. a host page's hand-tuned embed geometry)
   * instead of the generated one. Node ids must match the seed ValueChain's
   * ("user", "need", "dependency-1", "dependency-2", "dependency-3") — relabeling
   * is keyed by those ids. The Need node must be `draggable: true` with a `start`,
   * matching what `layoutValueChain` produces by default.
   */
  config?: DemoConfig;
}

/**
 * One continuous flow: drag the generic Need into place (Phase 0), wait for
 * the visitor to click the "Next" link rendered into `nextControl`, then the
 * Toolbox walks them through a 5-step form (need -> user -> 3 capabilities)
 * that relabels each placeholder node as its answer comes in (Phase 1),
 * celebrating once more at the end now that the chain is fully personalized.
 * The Toolbox is then emptied to a full-height placeholder (`Panel.showEmpty`)
 * rather than collapsed — it stays in place, ready for Phase 2's content —
 * and a second "Next" link gates the move into Phase 2 (`onEvolutionReady`).
 * Once that fires, the Toolbox swaps to `Panel.showInstrumentPanel` showing the
 * Need's label, its starting evolution stage ("Genesis"), and the matching
 * characteristics text from `domain/evolution.ts` — updating live
 * (`Panel.updateInstrumentPanel`) as the visitor drags the Need along the
 * evolution axis (`demo.runEvolutionDragStep`). A
 * "Confirm placement" link (`Panel.confirmPlacement`, rendered inside the
 * Toolbox itself rather than `nextControl` — `nextControl` lives inside the
 * host's `.wd-explanation` block, which is hidden for the rest of Phase 2)
 * appears the first time the Need is dropped, and resolves this function
 * once clicked. The same drag-confirm pattern then repeats for Capability-1/2/3
 * in turn (each slides into the Genesis column, beckons, and gets its own
 * placeholder heading/subheading), and once all four nodes are placed the
 * scenario fires one last `demo.celebrateAll()`.
 */
export async function runValueChainScenario(options: ValueChainScenarioOptions): Promise<WardleyDemo> {
  let chain = seedValueChain;
  const demoConfig = options.config ?? layoutValueChain(chain, options.layout);
  const panel = new Panel(options.toolbox);
  const dragHandle = panel.showDragHandles(PANEL_SLOTS);

  let demo!: WardleyDemo;
  await new Promise<void>((resolve) => {
    demo = WardleyDemo.mount(
      options.canvas,
      {
        ...demoConfig,
        onComplete: () => {
          dragHandle.complete();
          resolve();
        },
      },
      { dragHandle: dragHandle.activeElement },
    );
    options.onMount?.(demo);
  });

  options.onNeedPlaced?.();
  await showNextLink(options.nextControl);

  const needId = await panel.showField({
    type: "select",
    prompt: "What does the user need?",
    options: NEED_CATALOG.map((need) => ({ value: need.id, label: need.label })),
  });
  const needOption = NEED_CATALOG.find((need) => need.id === needId)!;
  chain = relabelNeed(chain, needOption.label);
  demo.relabelNode(chain.need.id, chain.need.label);

  const userLabel = await panel.showField({
    type: "text",
    prompt: "Who needs " + needOption.label + "?",
    placeholder: "Commuter",
  });
  chain = relabelUser(chain, userLabel);
  demo.relabelNode(chain.user.id, chain.user.label);

  const capabilityCount = seedValueChain.capabilities.length;
  for (let i = 0; i < capabilityCount; i++) {
    const capability = seedValueChain.capabilities[i];
    const capabilityLabel = await panel.showField({
      type: "text",
      prompt: `What's something they depend on to get this need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: "Kettle",
    });
    chain = relabelCapability(chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }

  panel.showEmpty();
  demo.celebrateAll();
  options.onCelebrate?.();

  await showNextLink(options.nextControl);
  const scale = demo.captureScale();
  options.onEvolutionReady?.();
  demo.stopCharging([chain.user.id, chain.need.id]);
  panel.showInstrumentPanel(chain.need.label, "need", "Genesis", MAP_CAPTION_FADE_MS);
  demo.showMapBackdrop(
    scale,
    options.toolbox.getBoundingClientRect().height,
    "Now let's turn your *Value Chain*\r\ninto a *Wardley Map*!",
  );
  // staggered by the same delay as the Toolbox placeholder's fade-in (panel.showPlaceholder
  // above), so the Need visibly settles into Genesis in step with the rest of Phase 2's reveal
  // rather than sliding immediately while the caption/placeholder are still fading in.
  setTimeout(() => demo.slideToGenesis(chain.need.id), MAP_CAPTION_FADE_MS);
  demo.beckonNode(chain.need.id);

  await awaitEvolutionConfirm(demo, panel, chain.need.id, options.onEvolutionStep);

  for (const capability of chain.capabilities) {
    panel.showInstrumentPanel(capability.label, "capability", "Genesis");
    demo.beckonNode(capability.id);
    demo.slideToGenesis(capability.id);
    await awaitEvolutionConfirm(demo, panel, capability.id, options.onEvolutionStep);
  }

  panel.showPlaceholder("Wardley Map", "All placed!");
  demo.celebrateAll(2);

  await panel.confirmPlacement("What's next →");
  options.onComplete?.();

  return demo;
}
