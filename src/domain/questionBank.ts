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
      annotation: "Danger: Bias",
    },
    {
      id: "unknown",
      label: "Unknown — not sure.",
      annotation: "Bias: Unknown!",
    },
  ],
};

/** the "build vs. buy vs. outsource" leadership concept's deep-dive question. */
export const BUILD_BUY_OUTSOURCE_QUESTION: Question = {
  id: "build-buy-outsource",
  prompt:
    "Building our own fits Genesis/Custom-Built (it's the only way to get one, or we think we can out-innovate). Buying fits late Custom-Built/Product (there are vendors — how we implement it is what matters). Outsourcing fits late Product/Commodity (we take the standard offering). Are we playing this the way its evolution stage calls for?",
  options: [
    {
      id: "yes",
      label: "Yes, we're playing it right.",
      annotation: "",
    },
    {
      id: "mixed",
      label: "Sort of — we're straddling two approaches.",
      annotation: "Caution: Build/Buy/Outsource",
    },
    {
      id: "no",
      label: "No, we're out of step with where this sits.",
      annotation: "Danger: Build/Buy/Outsource",
    },
    {
      id: "unknown",
      label: "Unknown — not sure.",
      annotation: "Build/Buy/Outsource: Unknown!",
    },
  ],
};

/** the "organizational inertia" climate concept's deep-dive question. */
export const INERTIA_QUESTION: Question = {
  id: "inertia",
  prompt: "Are we adapting readily to change here, regardless of habits, contracts, and sunk costs?",
  options: [
    { id: "no-inertia", label: "Yes — we are adapting readily.", annotation: "" },
    { id: "yes-inertia", label: "No — we are not adapting readily.", annotation: "Danger: Inertia" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Inertia: Unknown!" },
  ],
};

/** the "commodity vs. differentiation" climate concept's deep-dive question. */
export const DIFFERENTIATION_QUESTION: Question = {
  id: "differentiation",
  prompt:
    "Does this set you apart from competitors, or is it table stakes — necessary but not something anyone wins by having?",
  options: [
    { id: "differentiates", label: "Differentiates.", annotation: "Differentiates" },
    { id: "table-stakes", label: "Table stakes.", annotation: "Table Stakes" },
    { id: "neither", label: "Neither.", annotation: "" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Differentiation: Unknown!" },
  ],
};

/** the "using the right methods" doctrine concept's deep-dive question. */
export const METHOD_QUESTION: Question = {
  id: "method",
  prompt:
    "Agile suits Genesis/Custom-Built (explore and iterate quickly). Lean suits late Custom-Built/Product (continuously improve). Six Sigma suits late Product/Commodity (reduce deviation). Are we using the right methods for this stage?",
  options: [
    { id: "yes", label: "Yes, our methods fit.", annotation: "" },
    { id: "mixed", label: "Sort of — we're partway through switching methods.", annotation: "Caution: Method Mismatch" },
    { id: "no", label: "No, we're using the wrong methods for this stage.", annotation: "Danger: Wrong Methods" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Methods: Unknown!" },
  ],
};

/** the "efficiency enables innovation" climate concept's deep-dive question. */
export const EFFICIENCY_ENABLES_INNOVATION_QUESTION: Question = {
  id: "efficiency-innovation",
  prompt:
    "Innovative Genesis/Custom-Built work is strongest when it's built on efficient Product/Commodity building blocks — not stacked on other innovation. Are we making the most of efficient building blocks here?",
  options: [
    { id: "yes-efficiency-innovation", label: "Yes.", annotation: "" },
    { id: "no-efficiency-innovation", label: "No.", annotation: "Danger: Inefficient Innovation" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Efficiency Enables Innovation: Unknown!" },
  ],
};

/** the "alliances" leadership concept's deep-dive question. */
export const ALLIANCES_QUESTION: Question = {
  id: "alliances",
  prompt: "Do we have any potential friends in this space with whom we could collaborate?",
  options: [
    { id: "yes-begin", label: "Not yet — we'd need to start building them.", annotation: "Alliances: Begin" },
    { id: "yes-maintain", label: "Yes — we should deepen them.", annotation: "Alliances: Maintain / Deepen" },
    { id: "no", label: "No. We're truly alone", annotation: "Alliances: None" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Alliances: Unknown!" },
  ],
};

/** the "education" leadership concept's deep-dive question. */
export const EDUCATION_QUESTION: Question = {
  id: "education",
  prompt:
    "Teaching people what it is, how it works, how to implement it, or how to use it can pay off. Would people make better choices if they understood this part better?",
  options: [
    { id: "yes-education", label: "Yes.", annotation: "Education Play" },
    { id: "no-education", label: "No.", annotation: "" },
    { id: "unknown", label: "Unknown — not sure.", annotation: "Education Play: Unknown!" },
  ],
};
