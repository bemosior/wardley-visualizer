import type { Component, ComponentKind } from "./component";
import {
  BIAS_CHECK_QUESTION,
  BUILD_BUY_OUTSOURCE_QUESTION,
  DIFFERENTIATION_QUESTION,
  HOW_NEEDS_EVOLVE_QUESTION,
  INERTIA_QUESTION,
  METHOD_QUESTION,
  SHARED_PURPOSE_QUESTION,
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
  /** the deep-dive multiple-choice question asked once the visitor opts in at the gate */
  question: Question;
}

/**
 * curated climate/doctrine/leadership concepts for Phase 30, deliberately kept small and
 * newcomer-legible rather than exhaustive. Each concept is restricted to the node kinds it
 * meaningfully applies to via `applicableKinds` (e.g. "how needs evolve" only makes sense
 * against a Need, not a Capability) — `candidateNodesForConcept` turns that into an ordered
 * list of actual nodes on the current map.
 */
export const CONCEPT_BANK: Concept[] = [
  {
    id: "novelty-bias",
    category: "doctrine",
    label: "Novelty Bias",
    definition: "Believing something is more novel or bespoke than it truly is.",
    applicableKinds: ["capability"],
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
    id: "needs-evolve",
    category: "climate",
    label: "How Needs Evolve",
    definition: "Needs evolve over time, too.",
    applicableKinds: ["need"],
    question: HOW_NEEDS_EVOLVE_QUESTION,
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
    id: "shared-purpose",
    category: "leadership",
    label: "Shared Purpose",
    definition: "Knowing what matters.",
    applicableKinds: ["user", "need"],
    question: SHARED_PURPOSE_QUESTION,
  },
];

/** the ordered candidate nodes a concept could be explored against, filtered from the chain's components (fixed user/need/capabilities order) by `concept.applicableKinds`. */
export function candidateNodesForConcept(chain: ValueChain, concept: Concept): Component[] {
  return valueChainComponents(chain).filter((c) => concept.applicableKinds.includes(c.kind));
}
