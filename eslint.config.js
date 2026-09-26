// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const PURITY = "core must stay pure and deterministic; pass values in via state or actions";

const nodeGlobals = { process: "readonly", console: "readonly", URL: "readonly" };

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.tsbuild/**",
      "**/coverage/**",
      ".planning/**",
      "**/__purity_probe__.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "vitest.config.ts", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.mjs", "vitest.config.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["scripts/*.mjs", "eslint.config.js"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: `No wall-clock time in core. ${PURITY}` },
        { name: "performance", message: `No timers/clocks in core. ${PURITY}` },
        { name: "setTimeout", message: `No scheduling in core. ${PURITY}` },
        { name: "setInterval", message: `No scheduling in core. ${PURITY}` },
        { name: "setImmediate", message: `No scheduling in core. ${PURITY}` },
        { name: "crypto", message: `No platform randomness in core. ${PURITY}` },
        { name: "window", message: `No browser globals in core. ${PURITY}` },
        { name: "document", message: `No browser globals in core. ${PURITY}` },
        { name: "process", message: `No Node globals in core. ${PURITY}` },
        { name: "globalThis", message: `No ambient global access in core. ${PURITY}` },
        { name: "console", message: `No I/O in core; emit events instead. ${PURITY}` },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in state.hidden.rng" },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                "fs",
                "path",
                "zod",
                "@usurpia/client",
                "@usurpia/sim",
                "@usurpia/content",
                "**/content/**",
                "**/sim/**",
                "**/client/**",
              ],
              message: "core must stay pure and dependency-free",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.ts"],
    // vitest.config.ts is linted without type information (see disableTypeChecked above).
    ignores: ["vitest.config.ts"],
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  eslintConfigPrettier,
);
