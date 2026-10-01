import { describe, expect, it } from "vitest";
import { ContentInvalidError, loadRules } from "../src/node";
import { cleanupTemp, copyDataToTemp } from "./helpers";

describe("loadRules", () => {
  it("throws ContentInvalidError carrying the error lines and the ContentError list", () => {
    const dir = copyDataToTemp({
      file: "classes.json",
      mutate: (root) => {
        const classes = root.classes as { starter: { weapon: string } }[];
        const [first] = classes;
        if (first === undefined) throw new Error("no classes");
        first.starter.weapon = "no-such-id";
      },
    });
    try {
      let thrown: unknown;
      try {
        loadRules(dir);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ContentInvalidError);
      const error = thrown as ContentInvalidError;
      expect(error.name).toBe("ContentInvalidError");
      expect(error.message).toBe(
        "content invalid: 1 errors\nclasses.json classes.0.starter.weapon: starter weapon must be an existing gear id",
      );
      expect(error.errors).toEqual([
        {
          file: "classes.json",
          path: "classes.0.starter.weapon",
          message: "starter weapon must be an existing gear id",
        },
      ]);
    } finally {
      cleanupTemp(dir);
    }
  });

  it("loads the shipped content", () => {
    expect(loadRules().v).toBe(1);
  });
});
