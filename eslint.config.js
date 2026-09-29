// @ts-check
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

const PURITY = "core must stay pure and deterministic; pass values in via state or actions";

const CORE_IMPORT_RESTRICTIONS = {
  // Bare Node builtins by exact name (`paths`, not `patterns`, so local `./events` stays legal).
  paths: [
    "crypto",
    "os",
    "child_process",
    "module",
    "worker_threads",
    "perf_hooks",
    "util",
    "events",
    "url",
    "buffer",
  ].map((name) => ({ name, message: "core must stay pure and dependency-free" })),
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
};

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
    // Inline `eslint-disable` comments must not be able to switch purity rules off in core.
    linterOptions: { noInlineConfig: true },
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
        { name: "Intl", message: `No locale/time-zone dependent APIs in core. ${PURITY}` },
        { name: "Reflect", message: `No reflective escape hatches in core. ${PURITY}` },
        { name: "eval", message: `No dynamic code in core. ${PURITY}` },
        { name: "Function", message: `No dynamic code in core. ${PURITY}` },
        { name: "WeakRef", message: `No GC-observable behaviour in core. ${PURITY}` },
        { name: "FinalizationRegistry", message: `No GC-observable behaviour in core. ${PURITY}` },
        { name: "require", message: `No module loading in core. ${PURITY}` },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message: `No dynamic import() in core. ${PURITY}`,
        },
        {
          // Math may only be used as `Math.<name>` (so no-restricted-properties sees every access);
          // aliasing (`const M = Math`), passing, destructuring or computed access is banned.
          selector:
            "Identifier[name='Math']:not(MemberExpression[computed=false] > Identifier.object):not(MemberExpression[computed=false] > Identifier.property):not(Property > Identifier.key)",
          message: `Use Math only as Math.<member>; aliasing hides Math.random. ${PURITY}`,
        },
        {
          // `(() => 0).constructor` is Function (likewise generator/async variants): dynamic code.
          selector: "MemberExpression[property.name='constructor']",
          message: `No .constructor access in core (reaches Function). ${PURITY}`,
        },
        {
          selector: "MemberExpression[property.value='constructor']",
          message: `No .constructor access in core (reaches Function). ${PURITY}`,
        },
        {
          selector: "ObjectPattern > Property[key.name='constructor']",
          message: `No .constructor access in core (reaches Function). ${PURITY}`,
        },
        {
          selector: "MemberExpression[computed=true][property.type='TemplateLiteral']",
          message: `No template-literal computed member access in core. ${PURITY}`,
        },
        {
          selector: "CallExpression[callee.property.name=/^(localeCompare|toLocale\\w*)$/]",
          message: `No locale-dependent APIs in core (cross-platform hash drift). ${PURITY}`,
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in state.hidden.rng" },
      ],
      "no-restricted-imports": ["error", CORE_IMPORT_RESTRICTIONS],
    },
  },
  {
    // Reducer, handlers and the rest of core must not depend on the CPU AI (it runs outside reduce).
    files: ["packages/core/src/**/*.ts"],
    ignores: ["packages/core/src/ai/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: CORE_IMPORT_RESTRICTIONS.paths,
          patterns: [
            ...CORE_IMPORT_RESTRICTIONS.patterns,
            {
              regex: "(^|/)ai(/|$)",
              message: "reducer/handlers/core must not import the CPU AI (ai/ runs outside reduce)",
            },
          ],
        },
      ],
    },
  },
  {
    // The AI reads PlayerView + Rules only and uses engine-independent arithmetic.
    files: ["packages/core/src/ai/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: CORE_IMPORT_RESTRICTIONS.paths,
          patterns: [
            ...CORE_IMPORT_RESTRICTIONS.patterns,
            {
              regex: "(^|/)(reducer|handlers|index|serialize|game|replay)(/|$)",
              message:
                "the AI reads PlayerView + Rules only (no reducer, handlers, or modules exposing GameState)",
            },
            { regex: "^@usurpia/core(/|$)", message: "the AI must use relative imports" },
            {
              regex: ".*",
              importNames: ["GameState", "HiddenState"],
              message: "the AI reads PlayerView only",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in state.hidden.rng" },
        ...["exp", "log", "pow"].map((property) => ({
          object: "Math",
          property,
          message: "AI arithmetic must be engine-independent; use expNeg",
        })),
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
