import type { Component } from "../../domain/component";
import { CONCEPT_BANK, candidateNodesForConcept, type Concept } from "../../domain/conceptBank";
import type { ValueChain } from "../../domain/valueChain";
import type { Finding, GateOption } from "../../engine/panel";
import type { WardleyDemo } from "../../engine/WardleyDemo";
import type { ScenarioContext } from "./index";

interface Pairing {
  concept: Concept;
  node: Component;
}

/** flattens the concept bank into one ordered (concept, candidate node) list, concept-major, restricted to each node's current evolution stage where a concept cares (`Concept.applicableStages`) */
function buildPairings(chain: ValueChain, demo: WardleyDemo): Pairing[] {
  return CONCEPT_BANK.flatMap((concept) =>
    candidateNodesForConcept(chain, concept, (nodeId) => demo.getNodeStage(nodeId)).map((node) => ({
      concept,
      node,
    })),
  );
}

const samePairing = (a: Pairing, b: Pairing): boolean =>
  a.concept.id === b.concept.id && a.node.id === b.node.id;

/**
 * Phase 30: think with the map. Waits for the visitor to click "Let's get strategic →" (the
 * Phase 25 -> Phase 30 gate), then walks a curated bank of climate/doctrine/leadership concepts
 * (`domain/conceptBank.ts`'s `CONCEPT_BANK`) against candidate nodes on the map — each concept
 * further narrowed to the evolution stages it's meaningfully explored against, per node's
 * confirmed Phase 20 placement (`Concept.applicableStages`, `WardleyDemo.getNodeStage`).
 *
 * For each (concept, candidate node) pairing, in bank order: the mascot re-anchors to that node
 * and asks a gate question (`Mascot.showGate`) — "{concept.definition} Could we learn something
 * from exploring this with {node}?" — passing `[concept.label,
 * node.label]` as `showGate`'s `emphasize` list so both names stand out from the surrounding
 * prose (`Panel.renderWithEmphasis`) — with subtitle "Choosing is how you
 * learn!" on the very first gate of the phase,
 * "Keep going!" on every one after. Exactly three options are always offered: Yes, No, and
 * "Try something else" (shuffle) — abandons the current pairing and jumps to a uniformly random
 * other still-unresolved pairing anywhere in the bank.
 *
 * Yes leads into that concept's fixed deep-dive multiple-choice question (`Mascot.showQuestion`,
 * unchanged). If the chosen answer carries an `annotation`, it's anchored permanently near that
 * node via `demo.addAnnotation`, pushed onto `findings`, and the mascot immediately pauses on a
 * "Nice insight!" gate (Keep Going / Finish Up) — only insight-producing answers interrupt the
 * flow; an answer with no annotation falls straight through to the next pairing. "Finish Up" ends
 * the phase right there, same as naturally exhausting the bank. No re-poses the same gate for the
 * next candidate node of the *same* concept; once a concept has no candidates left (all declined,
 * via No or shuffle-abandonment), it advances to the next concept in bank order.
 *
 * The phase ends either via "Finish Up" or by naturally exhausting the whole bank (`remaining`
 * empties out). Either way, if any concept produced a finding, `Mascot.showFindings` renders a
 * concept-and-node-attributed report in place of the usual `showEmpty` — reusing its
 * `.wd-panel-content` container so the Finale's own "What's next →" confirm link (`finale.ts`)
 * appends directly beneath the list — before `celebrateAll(2)` + handoff to `finale.ts`.
 */
export async function runPhase30(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain } = ctx;

  await mascot.confirmPlacement("Let's get strategic →");

  let remaining = buildPairings(chain, demo);
  let gatesShown = 0;
  let current = remaining[0];
  const findings: Finding[] = [];

  while (current) {
    const pos = demo.getNodePixelPosition(current.node.id);
    if (pos) mascot.moveTo(current.node.id, pos);

    const subtitle = gatesShown++ === 0 ? "Choosing is how you learn!" : "Keep going!";
    const gateOptions: GateOption[] = [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "shuffle", label: "Try something else" },
    ];

    const choice = await mascot.showGate(
      `${current.concept.definition}\n\nCould we learn something from exploring this with ${current.node.label}?`,
      subtitle,
      gateOptions,
      [current.concept.label, current.node.label],
    );

    if (choice === "yes") {
      const answer = await mascot.showQuestion(current.node.label, current.concept.question);
      remaining = remaining.filter((p) => p.concept.id !== current!.concept.id);
      if (answer.annotation) {
        demo.addAnnotation(current.node.id, answer.annotation);
        findings.push({ concept: current.concept.label, node: current.node.label, text: answer.annotation });

        const next = await mascot.showGate(
          "Nice insight!\n\nThis sort of thing might factor into your strategy.",
          "",
          [
            { id: "keepGoing", label: "Keep Going" },
            { id: "finishUp", label: "Finish Up" },
          ],
        );
        if (next === "finishUp") break;
      }
      current = remaining[0];
      continue;
    }

    // "no" or "shuffle": drop the current pairing
    remaining = remaining.filter((p) => !samePairing(p, current!));

    current =
      choice === "shuffle"
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : (remaining.find((p) => p.concept.id === current!.concept.id) ?? remaining[0]);
  }

  if (findings.length > 0) {
    mascot.showFindings(findings, "Here's what you found, and you're barely scratching the surface!");
  } else {
    mascot.showEmpty();
  }
  demo.celebrateAll(2);
}
