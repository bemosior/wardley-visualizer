import type { Component } from "../../domain/component";
import { BIAS_CHECK_QUESTION, BUILD_BUY_OUTSOURCE_QUESTION, pickRandomQuestion, type Question } from "../../domain/questionBank";
import type { ScenarioContext } from "./index";

/**
 * Phase 30: think with the map. Waits for the visitor to click "Let's think about it →" (the
 * Phase 20 -> Phase 30 gate). The mascot becomes a Q&A guide (`Mascot.showQuestion`), re-anchoring
 * to each capability in turn and asking one multiple-choice doctrine question per capability — a
 * fixed bias-check question for Capability 1, a fixed build/buy/outsource question for
 * Capability 2, and a random pick (rerollable) from `domain/questionBank.ts`'s `QUESTION_POOL`
 * for Capability 3 — and each chosen answer's short `annotation` text is anchored permanently
 * near that capability's node via `demo.addAnnotation`. A final `demo.celebrateAll()` closes out
 * the placement/Q&A part of the scenario, gated behind one more "What's next →" link handled by
 * `finale.ts`.
 */
export async function runPhase30(ctx: ScenarioContext): Promise<void> {
  const { demo, mascot, chain } = ctx;

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
}
