import { WardleyDemo } from "../engine/WardleyDemo";
import { Panel } from "../engine/panel";
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

export interface ValueChainScenarioOptions {
  canvas: HTMLElement;
  toolbox: HTMLElement;
  onCelebrate?: () => void;
  /** override the generated layout's geometry; ignored if `config` is supplied */
  layout?: ValueChainLayoutOptions;
  /** supply a fully custom DemoConfig (e.g. a host page's hand-tuned embed geometry) instead of the generated one */
  config?: DemoConfig;
}

/**
 * Phase 1 of the tutorial: the Toolbox walks the visitor through a 5-step
 * form (need -> user -> 3 capabilities) instead of a drag step, relabeling
 * each placeholder node as its answer comes in, then celebrates once the
 * value chain is fully personalized.
 */
export async function runValueChainScenario(options: ValueChainScenarioOptions): Promise<WardleyDemo> {
  let chain = seedValueChain;
  const demoConfig = options.config ?? layoutValueChain(chain, { ...options.layout, draggable: false });
  const panel = new Panel(options.toolbox);
  const demo = WardleyDemo.mount(options.canvas, demoConfig);

  const needId = await panel.showField({
    type: "select",
    prompt: "What does this person need?",
    options: NEED_CATALOG.map((need) => ({ value: need.id, label: need.label })),
  });
  const needOption = NEED_CATALOG.find((need) => need.id === needId)!;
  chain = relabelNeed(chain, needOption.label);
  demo.relabelNode(chain.need.id, chain.need.label);

  const userLabel = await panel.showField({
    type: "text",
    prompt: "Who has this need?",
    placeholder: "e.g. A commuter",
  });
  chain = relabelUser(chain, userLabel);
  demo.relabelNode(chain.user.id, chain.user.label);

  const capabilityCount = seedValueChain.capabilities.length;
  for (let i = 0; i < capabilityCount; i++) {
    const capability = seedValueChain.capabilities[i];
    const capabilityLabel = await panel.showField({
      type: "text",
      prompt: `What's something they depend on to get this? (${i + 1} of ${capabilityCount})`,
      placeholder: "e.g. A kettle",
    });
    chain = relabelCapability(chain, capability.id, capabilityLabel);
    demo.relabelNode(capability.id, capabilityLabel);
  }

  panel.clear();
  demo.celebrate(chain.need.id);
  options.onCelebrate?.();

  return demo;
}
