import { describe, expect, it } from "vitest";
import { NEED_CATALOG } from "./needCatalog";

describe("NEED_CATALOG", () => {
  it("is non-empty", () => {
    expect(NEED_CATALOG.length).toBeGreaterThan(0);
  });

  it("has a unique id per option", () => {
    const ids = NEED_CATALOG.map((option) => option.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a non-empty label per option", () => {
    for (const option of NEED_CATALOG) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("has a non-empty userPlaceholder and 3 non-empty capabilityPlaceholders per option", () => {
    for (const option of NEED_CATALOG) {
      expect(option.userPlaceholder.trim().length).toBeGreaterThan(0);
      expect(option.capabilityPlaceholders).toHaveLength(3);
      for (const placeholder of option.capabilityPlaceholders) {
        expect(placeholder.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("scopes each option's placeholders to its own example, not shared across options", () => {
    const seen = new Set<string>();
    for (const option of NEED_CATALOG) {
      const placeholders = [option.userPlaceholder, ...option.capabilityPlaceholders];
      for (const placeholder of placeholders) {
        expect(seen.has(placeholder)).toBe(false);
        seen.add(placeholder);
      }
    }
  });
});
