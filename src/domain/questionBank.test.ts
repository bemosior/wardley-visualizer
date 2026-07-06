import { describe, expect, it } from "vitest";
import {
  BIAS_CHECK_QUESTION,
  BUILD_BUY_OUTSOURCE_QUESTION,
  DIFFERENTIATION_QUESTION,
  EFFICIENCY_ENABLES_INNOVATION_QUESTION,
  INERTIA_QUESTION,
  METHOD_QUESTION,
  SHARED_PURPOSE_QUESTION,
  type Question,
} from "./questionBank";

function expectValidQuestion(question: Question): void {
  expect(question.prompt.trim().length).toBeGreaterThan(0);
  expect(question.options.length).toBeGreaterThan(0);
  for (const option of question.options) {
    expect(option.label.trim().length).toBeGreaterThan(0);
    expect(option.annotation.trim().length).toBeGreaterThan(0);
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

describe("SHARED_PURPOSE_QUESTION", () => {
  it("is a well-formed question", () => expectValidQuestion(SHARED_PURPOSE_QUESTION));
});
