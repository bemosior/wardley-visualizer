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

/** the "novelty bias" doctrine concept's deep-dive question — checks for the classic anchoring/novelty bias. */
export const BIAS_CHECK_QUESTION: Question = {
  id: "bias-check",
  prompt: "Look at where you placed this — are you treating it as more novel or bespoke than that position suggests?",
  options: [
    {
      id: "no-bias",
      label: "No bias here.",
      annotation: "",
    },
    {
      id: "novelty-bias",
      label: "Possibly. We should check that.",
      annotation: "Danger: Novelty Bias",
    },
    {
      id: "unknown",
      label: "Unknown — not sure.",
      annotation: "Novelty Bias: Unknown!",
    },
  ],
};

/** the "build vs. buy vs. outsource" leadership concept's deep-dive question. */
export const BUILD_BUY_OUTSOURCE_QUESTION: Question = {
  id: "build-buy-outsource",
  prompt: "Given where this sits on the map, how should you treat it?",
  options: [
    {
      id: "build",
      label: "Build (stronger in Genesis / Custom-Built), since it's the only way to get one. Or maybe we think we can compete with the best.",
      annotation: "Build!",
    },
    {
      id: "buy",
      label: "Buy (stronger in late Custom Built and Product). There are plenty of vendors. How we implement it will be key.",
      annotation: "Buy!",
    },
    {
      id: "outsource",
      label: "Outsource (stronger in late Product and Commodity). We dare not play here. We'll take the standard version offered.",
      annotation: "Outsource!",
    },
    {
      id: "unknown",
      label: "Unknown — not sure.",
      annotation: "Build vs. Buy vs. Outsource: Unknown!",
    },
  ],
};

/** the "organizational inertia" climate concept's deep-dive question. */
export const INERTIA_QUESTION: Question = {
  id: "inertia",
  prompt: "Is anything — habits, contracts, sunk costs — holding us back from adapting to change here?",
  options: [
    { id: "no-inertia", label: "No — we are adapting readily.", annotation: "" },
    { id: "yes-inertia", label: "Yes — we are not adapting readily.", annotation: "Danger: Inertia" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Organizational Inertia: Unknown!" },
  ],
};

/** the "commodity vs. differentiation" climate concept's deep-dive question. */
export const DIFFERENTIATION_QUESTION: Question = {
  id: "differentiation",
  prompt: "Does this set you apart from competitors, or is it table stakes?",
  options: [
    { id: "differentiates", label: "It genuinely differentiates us.", annotation: "Differentiates" },
    { id: "table-stakes", label: "It's table stakes — everyone needs it, nobody wins because of it.", annotation: "Table Stakes" },
    { id: "neither", label: "It's neither — it's just there.", annotation: "" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Commodity vs. Differentiation: Unknown!" },
  ],
};

/** the "using the right methods" doctrine concept's deep-dive question. */
export const METHOD_QUESTION: Question = {
  id: "method",
  prompt: "Are you using the right methods for building and running it?",
  options: [
    { id: "agile", label: "Agile methods (stronger in Genesis and Custom-Built) to explore and iterate quickly.", annotation: "Methods: Agile" },
    { id: "lean", label: "Lean methods (stronger in late Custom-Built and Product) to continuously improve.", annotation: "Methods: Lean" },
    { id: "six-sigma", label: "Six Sigma methods (stronger late Product and Commodity) to reduce deviation.", annotation: "Methods: Six Sigma" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Using the Right Methods: Unknown!" },
  ],
};

/** the "efficiency enables innovation" climate concept's deep-dive question. */
export const EFFICIENCY_ENABLES_INNOVATION_QUESTION: Question = {
  id: "efficiency-innovation",
  prompt: "Are we taking advantage of efficient building blocks?",
  options: [
    { id: "yes-efficiency-innovation", label: "Yes, we're building innovative Genesis / Custom Built parts on top of efficient Product / Commodity parts.", annotation: "" },
    { id: "no-efficiency-innovation", label: "No. We're building innovation on top of innovation (risky) or failing to leverage efficient Product / Commodity parts.", annotation: "Danger: Inefficient Innovation" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Efficiency Enables Innovation: Unknown!" },
  ],
};

/** the "alliances" leadership concept's deep-dive question. */
export const ALLIANCES_QUESTION: Question = {
  id: "alliances",
  prompt: "Do we have any potential friends in this space with whom we could collaborate?",
  options: [
    { id: "yes-begin", label: "We could, but we'd have to start building those relationships.", annotation: "Alliances: Begin" },
    { id: "yes-maintain", label: "Yes. We ought to maintain and deepen those relationships.", annotation: "Alliances: Maintain / Deepen" },
    { id: "no", label: "No. There is zero chance.", annotation: "" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Alliances: Unknown!" },
  ],
};

/** the "education" leadership concept's deep-dive question. */
export const EDUCATION_QUESTION: Question = {
  id: "education",
  prompt: "Would people make better choices if they understood this part better?",
  options: [
    { id: "yes-education", label: "Yes. Teaching them what it is, how it works, how to implement it, or how to use it would be beneficial to us.", annotation: "Education Play" },
    { id: "no-education", label: "No. There's no value to education here.", annotation: "" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Education Play: Unknown!" },
  ],
};
