import type { WardleyDemo, EvolutionDragHandle } from "../../engine/WardleyDemo";
import type { Mascot } from "../../engine/mascot";
import type { ValueChain } from "../../domain/valueChain";
import type { ValueChainLayoutOptions } from "../../application/valueChainLayout";
import type { DemoConfig } from "../../engine/types";
import { runPhase0 } from "./phase0";
import { runPhase10 } from "./phase10";
import { runPhase20 } from "./phase20";
import { runPhase30 } from "./phase30";
import { runFinale } from "./finale";

export interface ValueChainScenarioOptions {
  canvas: HTMLElement;
  /**
   * host-supplied overlay the mascot mounts its avatar + speech bubble into, from the very
   * start of the scenario (Phase 0's drag affordance onward). Must be a child of `canvas`
   * itself (not a plain sibling element) — see the `.wd-mascot-host` doc comment in
   * `engine/styles.ts` for why: the mascot's positioning math is measured relative to
   * `canvas`'s own top-left corner, the same coordinate space `WardleyDemo`'s firework bursts
   * already render into.
   */
  mascotHost: HTMLElement;
  /** fires as soon as the Need snaps into place (Phase 0 done); the scenario then shows a "Next" link inside the mascot's bubble and waits for the visitor to click it before the mascot walks into the Phase 10 form */
  onNeedPlaced?: () => void;
  onCelebrate?: () => void;
  /** fires right after the canvas mounts, before the drag step resolves — lets a caller grab the `WardleyDemo` instance early enough to call `skipDrag()` (see `src/dev/autopilot.ts`) */
  onMount?: (demo: WardleyDemo) => void;
  /** fires once the visitor clicks the second "Next" link (shown inside the mascot's bubble after the celebration) — the signal that Phase 20 starts */
  onEvolutionReady?: () => void;
  /** fires once the visitor clicks "What's next →" at the very end of Phase 20, after all nodes are placed on the evolution axis and the finale celebration runs */
  onComplete?: () => void;
  /** called with each EvolutionDragHandle as Phase 20 drag steps begin — lets autopilot call skipDrag() to bypass real pointer events */
  onEvolutionStep?: (handle: EvolutionDragHandle) => void;
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
 * shared, mutable state threaded from one phase function to the next. `chain` is reassigned
 * (not mutated in place) as each phase relabels it — `ValueChain` itself stays an immutable
 * value (see `domain/valueChain.ts`), only this holder's reference changes, same as the original
 * single-function version's closure-scoped `let chain`.
 */
export interface ScenarioContext {
  demo: WardleyDemo;
  mascot: Mascot;
  chain: ValueChain;
  options: ValueChainScenarioOptions;
}

/**
 * One continuous flow, guided by a single `Mascot` (`engine/mascot.ts`) — a node-anchored speech
 * bubble plus small avatar — from the moment it mounts through the closing recap. Each phase is
 * implemented in its own file and threads a shared `ScenarioContext` from one to the next:
 *
 * - `phase0.ts` — drag the Need into place.
 * - `phase10.ts` — personalize the value chain via a 5-step form.
 * - `phase20.ts` — turn the value chain into a Wardley Map by placing every node on the evolution axis.
 * - `phase30.ts` — think with the map: one doctrine question per capability, each answer anchored to the map.
 * - `finale.ts` — recap and an external call-to-action link.
 *
 * See each file's doc comment for that phase's exact behavior.
 */
export async function runValueChainScenario(options: ValueChainScenarioOptions): Promise<WardleyDemo> {
  const ctx = await runPhase0(options);
  await runPhase10(ctx);
  await runPhase20(ctx);
  await runPhase30(ctx);
  await runFinale(ctx);
  return ctx.demo;
}
