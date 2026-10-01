import { rulesHash } from "@usurpia/core";
import { describe, expect, it } from "vitest";
import { buildRules } from "../src/index";
import { loadRules } from "../src/node";
import { buildShippedRules, SHIPPED_ENTRIES } from "../src/shipped";
import { loadEntries } from "./helpers";

describe("shipped (browser-safe) entry", () => {
  it("bundles exactly the files on disk, in loadContentDir order", () => {
    expect(SHIPPED_ENTRIES).toEqual(loadEntries());
  });

  it("builds the same rules as the Node loader (rulesHash 84a995db)", () => {
    const rules = buildShippedRules();
    expect(rulesHash(rules)).toBe("84a995db");
    expect(rules).toEqual(loadRules());
  });

  it("goes through buildRules (the entries validate)", () => {
    expect(buildRules(SHIPPED_ENTRIES).ok).toBe(true);
  });
});
