import type { Component } from "../../domain/component";
import { CONCEPT_BANK, candidateNodesForConcept, type Concept } from "../../domain/conceptBank";
import type { ValueChain } from "../../domain/valueChain";
import type { GateOption } from "../../engine/panel";
import type { ScenarioContext } from "./index";

interface Pairing {
  concept: Concept;
  node: Component;
}

/** flattens the concept bank into one ordered (concept, candidate node) list, concept-major */
function buildPairings(chain: ValueChain): Pairing[] {
  return CONCEPT_BANK.flatMap((concept) =>
    candidateNodesForConcept(chain, concept).map((node) => ({ concept, node })),
  );
}

const samePairing = (a: Pairing, b: Pairing): boolean =>
  a.concept.id === b.concept.id && a.node.id === b.node.id;

/** once at least this many concepts are settled, the gate grows a "Done" option */
const MIN_SETTLED_BEFORE_DONE = 3;

/**
 * Phase 30: think with the map. Waits for the visitor to click "Let's get strategic →" (the
 * Phase 25 -> Phase 30 gate), then walks a curated bank of climate/doctrine/leadership concepts
 * (`domain/conceptBank.ts`'s `CONCEPT_BANK`) against candidate nodes on the map.
 *
 * For each (concept, candidate node) pairing, in bank order: the mascot re-anchors to that node
 * and asks a gate question (`Mascot.showGate`) — "In Wardley Mapping, {concept.definition}.
 * Could we learn something from exploring this with {node}?" — passing `[concept.label,
 * node.label]` as `showGate`'s `emphasize` list so both names stand out from the surrounding
 * prose (`Panel.renderWithEmphasis`) — with subtitle "Choosing is how you
 * learn!" on the very first gate of the phase,
 * "Keep going!" on every one after. Yes/No are always offered, plus:
 *  - "Try something else" (shuffle): abandons the current pairing and jumps to a uniformly random
 *    other still-unresolved pairing anywhere in the bank.
 *  - "Done": only offered once at least `MIN_SETTLED_BEFORE_DONE` concepts have been *settled*
 *    (see below); ends the phase immediately.
 *
 * Yes leads into that concept's fixed deep-dive multiple-choice question (`Mascot.showQuestion`,
 * unchanged), and the chosen answer's `annotation` is anchored permanently near that node via
 * `demo.addAnnotation` — the concept is then settled. No re-poses the same gate for the next
 * candidate node of the *same* concept; once a concept has no candidates left (all declined, via
 * No or shuffle-abandonment), it's settled too, without an annotation. Either way settling advances
 * to the next concept in bank order once its own candidates run out.
 *
 * A `Set` of settled concept ids drives the "Done" threshold — checked once per gate, *before*
 * that gate's own outcome, so "Done" first appears on the gate *after* the one that settles the
 * 3rd concept, not on it. Don't "fix" this into a post-outcome check; it's the intended reading of
 * "once the visitor has encountered at least 3 concepts."
 *
 * The phase ends either via "Done" or by naturally exhausting the whole bank (`remaining` empties
 * out), both falling through to the same `celebrateAll(2)` + handoff to `finale.ts`.
 */
export async function runPhase30(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain } = ctx;

  await mascot.confirmPlacement("Let's get strategic →");

  let remaining = buildPairings(chain);
  const settled = new Set<string>();
  let gatesShown = 0;
  let current = remaining[0];

  while (current) {
    const pos = demo.getNodePixelPosition(current.node.id);
    if (pos) mascot.moveTo(current.node.id, pos);

    const subtitle = gatesShown++ === 0 ? "Choosing is how you learn!" : "Keep going!";
    const gateOptions: GateOption[] = [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "shuffle", label: "Try something else" },
    ];
    if (settled.size >= MIN_SETTLED_BEFORE_DONE) gateOptions.push({ id: "done", label: "Done" });

    const choice = await mascot.showGate(
      `In Wardley Mapping, ${current.concept.definition}.\n\nCould we learn something from exploring this with ${current.node.label}?`,
      subtitle,
      gateOptions,
      [current.concept.label, current.node.label],
    );

    if (choice === "done") break;

    if (choice === "yes") {
      const answer = await mascot.showQuestion(current.node.label, current.concept.question);
      demo.addAnnotation(current.node.id, answer.annotation);
      remaining = remaining.filter((p) => p.concept.id !== current!.concept.id);
      settled.add(current.concept.id);
      current = remaining[0];
      continue;
    }

    // "no" or "shuffle": drop the current pairing
    remaining = remaining.filter((p) => !samePairing(p, current!));
    if (!remaining.some((p) => p.concept.id === current!.concept.id)) settled.add(current.concept.id);

    current =
      choice === "shuffle"
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : (remaining.find((p) => p.concept.id === current!.concept.id) ?? remaining[0]);
  }

  mascot.showEmpty();
  demo.celebrateAll(2);
}
