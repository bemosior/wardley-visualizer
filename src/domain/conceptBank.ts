import type { Component, ComponentKind } from "./component";
import type { EvolutionStage } from "./evolution";
import {
  ALLIANCES_QUESTION,
  BIAS_CHECK_QUESTION,
  BUILD_BUY_OUTSOURCE_QUESTION,
  DIFFERENTIATION_QUESTION,
  EDUCATION_QUESTION,
  EFFICIENCY_ENABLES_INNOVATION_QUESTION,
  INERTIA_QUESTION,
  METHOD_QUESTION,
  type Question,
} from "./questionBank";
import { valueChainComponents, type ValueChain } from "./valueChain";

export type ConceptCategory = "climate" | "doctrine" | "leadership";

export interface Concept {
  id: string;
  category: ConceptCategory;
  /** must read naturally in the gate template: "exploring {label} with {node.label}" */
  label: string;
  /** one-sentence definition, shown ahead of the gate question: "In Wardley Mapping, {definition}" */
  definition: string;
  /** which node kinds this concept is meaningfully explored against */
  applicableKinds: ComponentKind[];
  /** which evolution stages this concept is meaningfully explored against, if restricted — omitted means all stages apply */
  applicableStages?: EvolutionStage[];
  /** the deep-dive multiple-choice question asked once the visitor opts in at the gate */
  question: Question;
}

/**
 * curated climate/doctrine/leadership concepts for Phase 30, deliberately kept small and
 * newcomer-legible rather than exhaustive. Each concept is restricted to the node kinds it
 * meaningfully applies to via `applicableKinds` (e.g. "novelty bias" only makes sense against
 * a Capability, not a Need), and optionally to the evolution stages it's meaningfully explored
 * against via `applicableStages` (e.g. "novelty bias" isn't a risk at Genesis, where something
 * genuinely is novel) — `candidateNodesForConcept` turns both into an ordered list of actual
 * nodes on the current map.
 */
export const CONCEPT_BANK: Concept[] = [
  {
    id: "novelty-bias",
    category: "doctrine",
    label: "Novelty Bias",
    definition: "Believing something is more novel or bespoke than it truly is.",
    applicableKinds: ["capability"],
    applicableStages: ["Product", "Commodity"],
    question: BIAS_CHECK_QUESTION,
  },
  {
    id: "right-methods",
    category: "doctrine",
    label: "Using the Right Methods",
    definition: "Agile, Lean, or Six Sigma. Which is best?",
    applicableKinds: ["capability"],
    question: METHOD_QUESTION,
  },
  {
    id: "inertia",
    category: "climate",
    label: "Organizational Inertia",
    definition: "Habits, contracts, or sunk costs holding us back.",
    applicableKinds: ["capability", "need"],
    applicableStages: ["Genesis", "Custom-Built", "Product"],
    question: INERTIA_QUESTION,
  },
  {
    id: "differentiation",
    category: "climate",
    label: "Commodity vs. Differentiation",
    definition: "Some things are tablestakes. Some things are differentiating.",
    applicableKinds: ["capability", "need"],
    question: DIFFERENTIATION_QUESTION,
  },
  {
    id: "efficiency-innovation",
    category: "climate",
    label: "Efficiency Enables Innovation",
    definition: "Things that are highly evolved make good building blocks.",
    applicableKinds: ["capability"],
    question: EFFICIENCY_ENABLES_INNOVATION_QUESTION,
  },
  {
    id: "build-buy-outsource",
    category: "leadership",
    label: "Build vs. Buy vs. Outsource",
    definition: "Should we build it? Buy it? Or outsource it?",
    applicableKinds: ["capability"],
    question: BUILD_BUY_OUTSOURCE_QUESTION,
  },
  {
    id: "alliances",
    category: "leadership",
    label: "Alliances",
    definition: "We don't have to act alone.",
    applicableKinds: ["capability"],
    question: ALLIANCES_QUESTION,
  },
  {
    id: "education",
    category: "leadership",
    label: "Education",
    definition: "Making people smarter can make a big difference.",
    applicableKinds: ["capability", "need"],
    applicableStages: ["Genesis", "Custom-Built", "Product"],
    question: EDUCATION_QUESTION,
  },
];

/**
 * the ordered candidate nodes a concept could be explored against, filtered from the chain's
 * components (fixed user/need/capabilities order) by `concept.applicableKinds` and, if the
 * concept restricts stages and `getStage` is supplied, by `concept.applicableStages` too. A node
 * whose stage `getStage` can't resolve (not yet placed on the evolution axis, or no `getStage`
 * passed at all) is kept rather than dropped — stage filtering only narrows nodes with a known
 * stage that falls outside the concept's list.
 */
export function candidateNodesForConcept(
  chain: ValueChain,
  concept: Concept,
  getStage?: (nodeId: string) => EvolutionStage | undefined,
): Component[] {
  return valueChainComponents(chain).filter((c) => {
    if (!concept.applicableKinds.includes(c.kind)) return false;
    if (!concept.applicableStages) return true;
    const stage = getStage?.(c.id);
    return stage === undefined || concept.applicableStages.includes(stage);
  });
}
