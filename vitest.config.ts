import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/*",
      "!packages/core",
      {
        test: {
          name: "@usurpia/core",
          root: "packages/core",
          // Runtime purity backstop: eval / new Function / generator-constructor code throw
          // EvalError inside core tests (asserted in packages/core/test/purity.test.ts).
          execArgv: ["--disallow-code-generation-from-strings"],
        },
      },
    ],
  },
});
