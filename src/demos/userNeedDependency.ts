import { WardleyDemo } from "../engine/WardleyDemo";
import { Panel, type PanelDragSlot } from "../engine/panel";
import { showNextLink } from "../engine/nextLink";
import { createValueChain, relabelCapability, relabelNeed, relabelUser } from "../domain/valueChain";
import { layoutValueChain, type ValueChainLayoutOptions } from "../application/valueChainLayout";
import { NEED_CATALOG } from "../domain/needCatalog";
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

const PANEL_SLOTS: PanelDragSlot[] = [
  { id: "user", iconText: "User", label: "Who It's For", active: false },
  { id: "need", iconText: "User Need", label: "What They Get", active: true },
  { id: "capability", iconText: "Capability", label: "How They Get It", active: false },
];

export interface ValueChainScenarioOptions {
  canvas: HTMLElement;
  toolbox: HTMLElement;
  /**
   * host-supplied container for the "Next" link that gates the switch from
   * Phase 0 into the Phase 1 form — typically placed beneath the host's own
   * explanation text, not inside the Toolbox.
   */
  nextControl: HTMLElement;
  /** fires as soon as the Need snaps into place (Phase 0 done); the scenario then shows a "Next" link in `nextControl` and waits for the visitor to click it before switching the Toolbox into the Phase 1 form */
  onNeedPlaced?: () => void;
  onCelebrate?: () => void;
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
    prompt: "Who has this need?",
    placeholder: "e.g. Commuter",
  });
  chain = relabelUser(chain, userLabel);
  demo.relabelNode(chain.user.id, chain.user.label);

  const capabilityCount = seedValueChain.capabilities.length;
  for (let i = 0; i < capabilityCount; i++) {
    const capability = seedValueChain.capabilities[i];
    const capabilityLabel = await panel.showField({
      type: "text",
      prompt: `What's something they depend on to get this need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: "e.g. Kettle",
    });
    chain = relabelCapability(chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }

  panel.clear();
  demo.celebrateAll();
  options.onCelebrate?.();

  return demo;
}
