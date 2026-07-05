export interface QuestionOption {
  id: string;
  /** full consideration text, shown in the multiple-choice list during the quiz */
  label: string;
  /** short text for the persistent map callout once this option is chosen */
  annotation: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
}

/** Phase 30's first question, anchored to Capability 1 — checks for the classic anchoring/novelty bias. */
export const BIAS_CHECK_QUESTION: Question = {
  id: "bias-check",
  prompt: "Look at where you placed this — are you treating it as more novel or bespoke than that position suggests?",
  options: [
    {
      id: "no-bias",
      label: "No — I've genuinely assessed it against real alternatives on the market.",
      annotation: "Bias check: clear",
    },
    {
      id: "novelty-bias",
      label: "Maybe — we call it special partly because we built it ourselves, not because it's actually novel.",
      annotation: "Watch: novelty bias",
    },
    {
      id: "sunk-cost",
      label: "Possibly — we've already invested a lot in it, which makes it feel more custom than it is.",
      annotation: "Watch: sunk-cost bias",
    },
  ],
};

/** Phase 30's second question, anchored to Capability 2 — build vs buy vs outsource doctrine. */
export const BUILD_BUY_OUTSOURCE_QUESTION: Question = {
  id: "build-buy-outsource",
  prompt: "Given where this sits on the map, how should you treat it?",
  options: [
    {
      id: "build",
      label: "It's early and uncertain, and we understand it better than anyone outside — build it ourselves.",
      annotation: "Build",
    },
    {
      id: "buy",
      label: "It's becoming common enough that vendors already do this well — buy a product or plan to compete.",
      annotation: "Buy (or Compete)",
    },
    {
      id: "outsource",
      label: "It's commodity now — there's no advantage in doing this ourselves unless we are already positioned to outlast the competition despite lowering margins  — outsource it.",
      annotation: "Outsource (or Outlast)",
    },
  ],
};

/** pool for Phase 30's third question, anchored to Capability 3 — re-rollable via `pickRandomQuestion`. */
export const QUESTION_POOL: Question[] = [
  {
    id: "inertia",
    prompt: "Is anything — habit, a contract, sunk cost — holding us back from adapting to change here?",
    options: [
      { id: "no-inertia", label: "No — we adapt readily, without extra friction.", annotation: "No inertia" },
      { id: "org-habit", label: "Yes — the team keeps treating it the way it's always been treated, regardless of where it's actually moved.", annotation: "Watch: org habit" },
      { id: "contract-lockin", label: "Yes — an existing contract or vendor relationship locks in how we treat it.", annotation: "Watch: contract lock-in" },
      { id: "sunk-cost-inertia", label: "Yes — we've invested too much in the old approach to change course now, even though the situation has moved on.", annotation: "Watch: sunk-cost inertia" },
    ],
  },
  {
    id: "differentiation",
    prompt: "Does this set you apart from competitors, or is it table stakes?",
    options: [
      { id: "differentiates", label: "It differentiates us.", annotation: "Differentiates" },
      { id: "table-stakes", label: "It's table stakes — everyone needs it, nobody wins because of it.", annotation: "Table stakes" },
    ],
  },
  {
    id: "method",
    prompt: "Given its evolutionary stage, are you using the right methods for building and running this component?",
    options: [
      { id: "matched", label: "Yes — agile iteration if early evolution, lean continuous improvement if in the middle, six sigma towards control if late evolution.", annotation: "Methods: appropriate" },
      { id: "stuck-in-agile", label: "No — we're still treating it as an open-ended experiment long after it became standard practice.", annotation: "Watch: misapplied agile methods" },
      { id: "premature-six-sigma", label: "No — we're already forcing rigid, standardized process onto something that's still genuinely uncertain.", annotation: "Watch: misapplied six sigma methods" },
    ],
  },
];

/** picks a random pool question, excluding `excludeId` (used by reroll so it never repeats the current one) */
export function pickRandomQuestion(excludeId?: string): Question {
  const candidates = QUESTION_POOL.filter((q) => q.id !== excludeId);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
