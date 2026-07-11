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

  it("has a non-empty user and at least 3 non-empty capabilityOptions per option", () => {
    for (const option of NEED_CATALOG) {
      expect(option.user.trim().length).toBeGreaterThan(0);
      expect(option.capabilityOptions.length).toBeGreaterThanOrEqual(3);
      for (const capability of option.capabilityOptions) {
        expect(capability.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // user is intentionally excluded here: several options deliberately share the same user (that
  // user's other needs), so it repeats across options by design -- see needCatalog.ts.
  it("scopes each option's capability options to its own example, not shared across options", () => {
    const seen = new Set<string>();
    for (const option of NEED_CATALOG) {
      for (const capability of option.capabilityOptions) {
        expect(seen.has(capability)).toBe(false);
        seen.add(capability);
      }
    }
  });
});
