import type { ComponentKind } from "./component";

/** the four Wardley evolution-axis stages, left to right — single source of truth shared with `render.ts`'s band math. */
export const EVOLUTION_STAGES = ["Genesis", "Custom-Built", "Product", "Commodity"] as const;

export type EvolutionStage = (typeof EVOLUTION_STAGES)[number];

/**
 * characteristics text per evolution stage, split by whether the node being dragged is a
 * user need or a capability (the forecast calls out that a capability's characteristics
 * read differently than a need's at the same stage — e.g. "outsource vs build" only makes
 * sense for a capability). `"user"` isn't included: the User node never gets dragged along
 * the evolution axis.
 */
const CHARACTERISTICS: Record<Exclude<ComponentKind, "user">, Record<EvolutionStage, string>> = {
  need: {
    Genesis: "If so, it's rare, poorly understood, still being discovered — people don't yet know they want this.",
    "Custom-Built": "If so, it's recognized by early adopters, but still bespoke — no two people expect it the same way.",
    Product: "If so, it's increasingly familiar — most people recognize the need and expect it to be met well.",
    Commodity: "If so, it's universally expected, assumed by default — its absence would be surprising.",
  },
  capability: {
    Genesis: "If so, it's uncertain, experimental, high failure rate — best built in-house by whoever is closest to the unknown.",
    "Custom-Built": "If so, it's emerging best practice, still one-off per organization, seen as a competitive advantage — have to build, can't buy off the shelf.",
    Product: "If so, it's increasingly common, differentiated by features — advantage is in implementation.",
    Commodity: "If so, it's standardized, well understood, widespread in its market, important but invisible — high volume, reducing margin.",
  },
};

/** characteristics text for a given evolution stage and component kind. Throws for `"user"`, since User is never dragged along the evolution axis. */
export function characteristicsFor(kind: ComponentKind, stage: EvolutionStage): string {
  if (kind === "user") {
    throw new Error('characteristicsFor: "user" has no evolution characteristics — the User node is never dragged along the evolution axis.');
  }
  return CHARACTERISTICS[kind][stage];
}
