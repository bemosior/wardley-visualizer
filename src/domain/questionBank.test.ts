import { describe, expect, it } from "vitest";
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

function expectValidQuestion(question: Question): void {
  expect(question.prompt.trim().length).toBeGreaterThan(0);
  expect(question.options.length).toBeGreaterThan(0);
  for (const option of question.options) {
    expect(option.label.trim().length).toBeGreaterThan(0);
    // empty annotation is valid: it means no callout shown on the map for this answer
    expect(typeof option.annotation).toBe("string");
  }
  const ids = question.options.map((o) => o.id);
  expect(new Set(ids).size).toBe(ids.length);
}

describe("BIAS_CHECK_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(BIAS_CHECK_QUESTION));
});

describe("BUILD_BUY_OUTSOURCE_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(BUILD_BUY_OUTSOURCE_QUESTION));
});

describe("INERTIA_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(INERTIA_QUESTION));
});

describe("DIFFERENTIATION_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(DIFFERENTIATION_QUESTION));
});

describe("METHOD_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(METHOD_QUESTION));
});

describe("EFFICIENCY_ENABLES_INNOVATION_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(EFFICIENCY_ENABLES_INNOVATION_QUESTION));
});

describe("ALLIANCES_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(ALLIANCES_QUESTION));
});

describe("EDUCATION_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(EDUCATION_QUESTION));
});
