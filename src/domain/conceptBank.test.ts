import { describe, expect, it } from "vitest";
import type { ConceptCategory } from "./conceptBank";
import { CONCEPT_BANK, candidateNodesForConcept } from "./conceptBank";
import { createValueChain } from "./valueChain";

function buildChain() {
  return createValueChain({
    user: { id: "user", label: "User" },
    need: { id: "need", label: "Need" },
    capabilities: [
      { id: "dependency-1", label: "Part A" },
      { id: "dependency-2", label: "Part B" },
      { id: "dependency-3", label: "Part C" },
    ],
  });
}

describe("CONCEPT_BANK", () => {
  it("has unique ids", () => {
    const ids = CONCEPT_BANK.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every concept has a non-empty label and at least one applicable kind", () => {
    for (const concept of CONCEPT_BANK) {
      expect(concept.label.trim().length).toBeGreaterThan(0);
      expect(concept.applicableKinds.length).toBeGreaterThan(0);
    }
  });

  it("represents all three categories", () => {
    const categories = new Set(CONCEPT_BANK.map((c) => c.category));
    const expected: ConceptCategory[] = ["climate", "doctrine", "leadership"];
    for (const category of expected) expect(categories.has(category)).toBe(true);
  });

  it("every concept resolves to at least one candidate node against a standard value chain", () => {
    const chain = buildChain();
    for (const concept of CONCEPT_BANK) {
      expect(candidateNodesForConcept(chain, concept).length).toBeGreaterThan(0);
    }
  });
});

describe("candidateNodesForConcept", () => {
  it("filters to only the applicable kinds, in user/need/capabilities order", () => {
    const chain = buildChain();
    const capabilityOnly = CONCEPT_BANK.find((c) => c.id === "novelty-bias")!;
    expect(candidateNodesForConcept(chain, capabilityOnly).map((n) => n.id)).toEqual([
      "dependency-1",
      "dependency-2",
      "dependency-3",
    ]);

    const capabilityAndNeed = CONCEPT_BANK.find((c) => c.id === "inertia")!;
    expect(candidateNodesForConcept(chain, capabilityAndNeed).map((n) => n.id)).toEqual([
      "need",
      "dependency-1",
      "dependency-2",
      "dependency-3",
    ]);
  });

  it("further filters by evolution stage when the concept restricts it and a stage lookup is given", () => {
    const chain = buildChain();
    const noveltyBias = CONCEPT_BANK.find((c) => c.id === "novelty-bias")!;
    const stages: Record<string, "Genesis" | "Product"> = {
      "dependency-1": "Genesis",
      "dependency-2": "Product",
    };
    expect(
      candidateNodesForConcept(chain, noveltyBias, (nodeId) => stages[nodeId]).map((n) => n.id),
    ).toEqual(["dependency-2", "dependency-3"]);
  });

  it("keeps nodes whose stage the lookup can't resolve, rather than dropping them", () => {
    const chain = buildChain();
    const noveltyBias = CONCEPT_BANK.find((c) => c.id === "novelty-bias")!;
    expect(candidateNodesForConcept(chain, noveltyBias, () => undefined).map((n) => n.id)).toEqual([
      "dependency-1",
      "dependency-2",
      "dependency-3",
    ]);
    expect(candidateNodesForConcept(chain, noveltyBias).map((n) => n.id)).toEqual([
      "dependency-1",
      "dependency-2",
      "dependency-3",
    ]);
  });
});
