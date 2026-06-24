import { WardleyDemo } from "../engine/WardleyDemo";
import { Panel, type PanelDragSlot } from "../engine/panel";
import { createValueChain } from "../domain/valueChain";
import { layoutValueChain, type ValueChainLayoutOptions } from "../application/valueChainLayout";
import type { DemoConfig } from "../engine/types";

const valueChain = createValueChain({
  user: { id: "user", label: "User" },
  need: { id: "need", label: "Need" },
  capabilities: [
    { id: "dependency-1", label: "Capability" },
    { id: "dependency-2", label: "Capability" },
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
  onCelebrate?: () => void;
  /** override the generated layout's geometry; ignored if `config` is supplied */
  layout?: ValueChainLayoutOptions;
  /** supply a fully custom DemoConfig (e.g. a host page's hand-tuned embed geometry) instead of the generated one */
  config?: DemoConfig;
}

/**
 * Phase 0 of the tutorial: a single step — drag the User Need into place.
 * Wires the Panel's drag handle and the WardleyDemo's completion celebration
 * so host pages don't each re-implement this plumbing.
 */
export function runValueChainScenario(options: ValueChainScenarioOptions): WardleyDemo {
  const demoConfig = options.config ?? layoutValueChain(valueChain, options.layout);
  const panel = new Panel(options.toolbox);
  const dragHandle = panel.showDragHandles(PANEL_SLOTS);

  return WardleyDemo.mount(
    options.canvas,
    {
      ...demoConfig,
      onComplete: () => {
        dragHandle.complete();
        options.onCelebrate?.();
      },
    },
    { dragHandle: dragHandle.activeElement },
  );
}
