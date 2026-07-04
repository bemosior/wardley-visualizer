import { WardleyDemo, MAP_CAPTION_FADE_MS } from "../engine/WardleyDemo";
import { Panel, type PanelDragSlot } from "../engine/panel";
import { Mascot } from "../engine/mascot";
import { PANEL_CONTENT_MIN_HEIGHT } from "../engine/styles";
import { showNextLink } from "../engine/nextLink";
import { createValueChain, relabelCapability, relabelNeed, relabelUser } from "../domain/valueChain";
import type { Component } from "../domain/component";
import { layoutValueChain, type ValueChainLayoutOptions } from "../application/valueChainLayout";
import { NEED_CATALOG } from "../domain/needCatalog";
import { BIAS_CHECK_QUESTION, BUILD_BUY_OUTSOURCE_QUESTION, pickRandomQuestion, type Question } from "../domain/questionBank";
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
 * the same interaction after it. The "Confirm placement" link renders inside the mascot's speech
 * bubble (`mascot.confirmPlacement`), not the host's `nextControl`, since the Toolbox (and the
 * host's explanation column) are both hidden by this point in the flow.
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

const PANEL_SLOTS: PanelDragSlot[] = [
  { id: "user", iconText: "User", label: "Who It's For", active: false },
  { id: "need", iconText: "User Need", label: "What They Get", active: true },
  { id: "capability", iconText: "Capability", label: "How They Get It", active: false },
];

export interface ValueChainScenarioOptions {
  canvas: HTMLElement;
  toolbox: HTMLElement;
  /**
   * host-supplied overlay the mascot mounts its avatar + speech bubble into, once Phase 2 begins.
   * Must be a child of `canvas` itself (not the Toolbox, and not a plain sibling element) — see
   * the `.wd-mascot-host` doc comment in `engine/styles.ts` for why: the mascot's positioning
   * math is measured relative to `canvas`'s own top-left corner, the same coordinate space
   * `WardleyDemo`'s firework bursts already render into.
   */
  mascotHost: HTMLElement;
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
 * rather than collapsed — it stays in place, ready for the second "Next" link
 * that gates the move into Phase 2 (`onEvolutionReady`). Once that fires, the
 * host collapses the Toolbox for good and a `Mascot` (`engine/mascot.ts`) —
 * a node-anchored speech bubble, composed of a second `Panel` instance plus a
 * small avatar — takes over as the guide for the rest of the flow. It shows
 * the Need's label, its starting evolution stage ("Genesis"), and the
 * matching characteristics text from `domain/evolution.ts` — updating live
 * (`Mascot.updateInstrumentPanel`) and tracking the node's on-screen position
 * (`Mascot.moveTo`) as the visitor drags the Need along the evolution axis
 * (`demo.runEvolutionDragStep`). A "Confirm placement" link
 * (`Mascot.confirmPlacement`, rendered inside the bubble) appears the first
 * time the Need is dropped, and resolves this function once clicked. The
 * same drag-confirm pattern then repeats for Capability-1/2/3 in turn (each
 * slides into the Genesis column, beckons, and gets its own bubble
 * heading/subheading, the mascot re-anchoring to each in turn), and once all
 * four nodes are placed the scenario fires `demo.celebrateAll()` (with the
 * mascot celebrating alongside it) for the placement finale. A further
 * "Confirm placement"-style link (`Mascot.confirmPlacement`) then gates
 * Phase 3: the mascot becomes a Q&A guide (`Mascot.showQuestion`), re-anchoring
 * to each capability in turn and asking one multiple-choice doctrine question
 * per capability — a fixed bias-check question for Capability 1, a fixed
 * build/buy/outsource question for Capability 2, and a random pick
 * (rerollable) from `domain/questionBank.ts`'s `QUESTION_POOL` for
 * Capability 3 — and each chosen answer's short `annotation` text is anchored
 * permanently near that capability's node via `demo.addAnnotation`. One final
 * `demo.celebrateAll()` and "What's next →" link close out the placement/Q&A
 * part of the scenario; clicking that link swaps the mascot's bubble to
 * `Mascot.showRecap` — a three-line recap of the whole session (value chain,
 * map, strategic thinking) plus an external CTA link to
 * LearnWardleyMapping.com — before `onComplete` fires.
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
    placeholder: needOption.userPlaceholder,
  });
  chain = relabelUser(chain, userLabel);
  demo.relabelNode(chain.user.id, chain.user.label);

  const capabilityCount = seedValueChain.capabilities.length;
  for (let i = 0; i < capabilityCount; i++) {
    const capability = seedValueChain.capabilities[i];
    const capabilityLabel = await panel.showField({
      type: "text",
      prompt: `What's something they depend on to get this need met? \r\n(${i + 1} of ${capabilityCount})`,
      placeholder: needOption.capabilityPlaceholders[i],
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

  // the host has just collapsed the Toolbox and expanded the canvas (onEvolutionReady above) —
  // the mascot mounts now that layout has settled, replacing the Toolbox for the rest of the flow
  const mascot = new Mascot(options.mascotHost, demo);
  mascot.mount();

  demo.stopCharging([chain.user.id, chain.need.id, ...chain.capabilities.map((c) => c.id)]);
  demo.markPending(chain.capabilities.map((c) => c.id));
  mascot.showInstrumentPanel(chain.need.label, "need", "Genesis", MAP_CAPTION_FADE_MS);
  demo.showMapBackdrop(
    scale,
    PANEL_CONTENT_MIN_HEIGHT,
    "Now let's turn your *Value Chain*\r\ninto a *Wardley Map*!",
  );
  // staggered by the same delay as the mascot bubble's fade-in (mascot.showInstrumentPanel
  // above), so the Need visibly settles into Genesis in step with the rest of Phase 2's reveal
  // rather than sliding immediately while the caption/bubble are still fading in.
  setTimeout(
    () =>
      demo.slideToGenesis(chain.need.id, undefined, () => {
        const pos = demo.getNodePixelPosition(chain.need.id);
        if (pos) mascot.moveTo(chain.need.id, pos);
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

  await mascot.confirmPlacement("Let's think about it →");

  const questionPlan: { capability: Component; question: Question; reroll: boolean }[] = [
    { capability: chain.capabilities[0], question: BIAS_CHECK_QUESTION, reroll: false },
    { capability: chain.capabilities[1], question: BUILD_BUY_OUTSOURCE_QUESTION, reroll: false },
    { capability: chain.capabilities[2], question: pickRandomQuestion(), reroll: true },
  ];

  for (const { capability, question, reroll } of questionPlan) {
    const pos = demo.getNodePixelPosition(capability.id);
    if (pos) mascot.moveTo(capability.id, pos);
    let current = question;
    const answer = await mascot.showQuestion(capability.label, current, {
      onReroll: reroll ? () => (current = pickRandomQuestion(current.id)) : undefined,
    });
    demo.addAnnotation(capability.id, answer.annotation);
  }

  mascot.showEmpty();
  demo.celebrateAll(2);

  await mascot.confirmPlacement("What's next →");
  mascot.showRecap(
    ["You made a Value Chain", "Then you turned it into a Wardley Map", "And finally, you used the map for strategic thinking! Well done!"],
    { label: "Take your next step →", href: "https://learnwardleymapping.com" },
  );
  mascot.setState("celebrating");
  options.onComplete?.();

  return demo;
}
