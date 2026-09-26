import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";

describe("sim smoke", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@usurpia/sim");
  });
});
