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
    definition:
      "Novelty Bias is treating something as more novel or bespoke than its actual position on the map suggests — often because you built it yourselves or have sunk cost in it",
    applicableKinds: ["capability"],
    question: BIAS_CHECK_QUESTION,
  },
  {
    id: "right-methods",
    category: "doctrine",
    label: "Using the Right Methods",
    definition:
      "Using the Right Methods means matching how you build and run something to its evolutionary stage — agile for genesis, lean for the middle, six sigma for commodity",
    applicableKinds: ["capability"],
    question: METHOD_QUESTION,
  },
  {
    id: "inertia",
    category: "climate",
    label: "Organizational Inertia",
    definition:
      "Organizational Inertia is habit, contracts, or sunk cost holding you back from adapting even after something's position on the map has moved",
    applicableKinds: ["capability", "need"],
    question: INERTIA_QUESTION,
  },
  {
    id: "differentiation",
    category: "climate",
    label: "Commodity vs. Differentiation",
    definition:
      "Commodity vs. Differentiation is the question of whether something sets you apart from competitors or is simply table stakes everyone needs",
    applicableKinds: ["capability", "need"],
    question: DIFFERENTIATION_QUESTION,
  },
  {
    id: "needs-evolve",
    category: "climate",
    label: "How Needs Evolve",
    definition:
      "How Needs Evolve matters too — a need that feels fixed today can shift as norms and expectations rise over time",
    applicableKinds: ["need"],
    question: HOW_NEEDS_EVOLVE_QUESTION,
  },
  {
    id: "build-buy-outsource",
    category: "leadership",
    label: "Build vs. Buy vs. Outsource",
    definition:
      "Build vs. Buy vs. Outsource is the choice of how to treat something based on where it sits on the map — build what's uncertain, buy what's becoming common, outsource what's commodity",
    applicableKinds: ["capability"],
    question: BUILD_BUY_OUTSOURCE_QUESTION,
  },
  {
    id: "shared-purpose",
    category: "leadership",
    label: "Shared Purpose",
    definition:
      "Shared Purpose is everyone acting on the map actually understanding why it matters, not just what to deliver",
    applicableKinds: ["user", "need"],
    question: SHARED_PURPOSE_QUESTION,
  },
];

/** the ordered candidate nodes a concept could be explored against, filtered from the chain's components (fixed user/need/capabilities order) by `concept.applicableKinds`. */
export function candidateNodesForConcept(chain: ValueChain, concept: Concept): Component[] {
  return valueChainComponents(chain).filter((c) => concept.applicableKinds.includes(c.kind));
}
