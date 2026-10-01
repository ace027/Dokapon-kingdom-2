// Negative probe: proves the core purity lint rules actually fire.
// Writes a deliberately impure file into packages/core/src, lints it, and asserts that every
// case below is reported by its expected rule on its own lines. Always removes the probe,
// including on SIGINT/SIGTERM.
import { unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const DEFAULT_PROBE = "packages/core/src/__purity_probe__.ts";
const AI_PROBE = "packages/core/src/ai/__purity_probe__.ts";

function probeUrl(relative) {
  return fileURLToPath(new URL(`../${relative}`, import.meta.url));
}

const AI_BANNED_MATH = [
  "acos",
  "acosh",
  "asin",
  "asinh",
  "atan",
  "atan2",
  "atanh",
  "cbrt",
  "cos",
  "cosh",
  "exp",
  "expm1",
  "hypot",
  "log",
  "log1p",
  "log10",
  "log2",
  "pow",
  "sin",
  "sinh",
  "tan",
  "tanh",
];

/**
 * Each case's lines are linted in place; `rule` must report on one of them. `path` (default
 * {@link DEFAULT_PROBE}) selects which probe file the case is written to.
 */
const CASES = [
  { name: "Math.random()", rule: "no-restricted-properties", lines: ["Math.random();"] },
  { name: "Date.now()", rule: "no-restricted-globals", lines: ["Date.now();"] },
  {
    name: 'import from "node:fs"',
    rule: "no-restricted-imports",
    lines: ['import { readFileSync } from "node:fs";', "void readFileSync;"],
  },
  {
    name: "aliased Math (const M = Math; M.random())",
    rule: "no-restricted-syntax",
    lines: ["const M = Math;", "M.random();"],
  },
  {
    name: "new Intl.DateTimeFormat()",
    rule: "no-restricted-globals",
    lines: ["new Intl.DateTimeFormat();"],
  },
  {
    name: 'await import("node:fs")',
    rule: "no-restricted-syntax",
    lines: ['await import("node:fs");'],
  },
  { name: 'import "crypto"', rule: "no-restricted-imports", lines: ['import "crypto";'] },
  {
    name: "(() => 0).constructor (Function via arrow)",
    rule: "no-restricted-syntax",
    lines: [
      "const F = (() => 0).constructor as new (...args: string[]) => () => number;",
      'void new F("return 1")();',
    ],
  },
  {
    name: "generator .constructor (GeneratorFunction)",
    rule: "no-restricted-syntax",
    lines: [
      "const G: unknown = Object.getPrototypeOf(function* () {",
      "  yield 0;",
      '})["constructor"];',
      "void G;",
    ],
  },
  {
    name: '"a".localeCompare("b")',
    rule: "no-restricted-syntax",
    lines: ['void "a".localeCompare("b");'],
  },
  {
    name: "inline eslint-disable-next-line",
    rule: "no-restricted-globals",
    lines: ["// eslint-disable-next-line no-restricted-globals", "Date.now();"],
  },
  {
    name: 'core imports the CPU AI (import "./ai/index")',
    rule: "no-restricted-imports",
    lines: ['import "./ai/index";'],
  },
  {
    name: "ai imports GameState from ../types",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import type { GameState } from "../types";', "export type G = GameState;"],
  },
  {
    name: "ai imports GameState from ../views (name ban via any path)",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import type { GameState } from "../views";', "export type G = GameState;"],
  },
  {
    name: "ai imports the reducer",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { reduce } from "../reducer";', "void reduce;"],
  },
  {
    name: "ai imports the core barrel",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { createGame } from "../index";', "void createGame;"],
  },
  {
    name: "ai imports serialize",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { deserialize } from "../serialize";', "void deserialize;"],
  },
  {
    name: "ai uses Math.random",
    rule: "no-restricted-properties",
    path: AI_PROBE,
    lines: ["export const r = Math.random();"],
  },
  {
    name: "ai imports HiddenState from ../types (name ban)",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import type { HiddenState } from "../types";', "export type H = HiddenState;"],
  },
  {
    name: "ai imports a handler (../handlers/combat)",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { combatStartHandler } from "../handlers/combat";', "void combatStartHandler;"],
  },
  {
    name: "ai imports ../game",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { createGame } from "../game";', "void createGame;"],
  },
  {
    name: "ai imports ../replay",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { replay } from "../replay";', "void replay;"],
  },
  {
    name: "ai imports @usurpia/core",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import { createGame } from "@usurpia/core";', "void createGame;"],
  },
  {
    name: "ai namespace-imports ../types (import * as T)",
    rule: "no-restricted-imports",
    path: AI_PROBE,
    lines: ['import * as T from "../types";', "export type G = T.GameState;"],
  },
  {
    name: 'ai type-level import("../types") (TSImportType)',
    rule: "no-restricted-syntax",
    path: AI_PROBE,
    lines: ['export type G = import("../types").GameState;'],
  },
  {
    name: 'core type-level import("./ai/index") (TSImportType)',
    rule: "no-restricted-syntax",
    lines: ['export type A = typeof import("./ai/index");'],
  },
  {
    name: "ai uses the ** operator",
    rule: "no-restricted-syntax",
    path: AI_PROBE,
    lines: ["export const p = 2 ** 0.5;"],
  },
  {
    name: "ai uses the **= operator",
    rule: "no-restricted-syntax",
    path: AI_PROBE,
    lines: ["let q = 2;", "q **= 0.5;", "export { q };"],
  },
  // One case per banned Math member (kept in sync with AI_BANNED_MATH in eslint.config.js).
  ...AI_BANNED_MATH.map((member) => ({
    name: `ai uses Math.${member}`,
    rule: "no-restricted-properties",
    path: AI_PROBE,
    lines: [`export const m_${member} = Math.${member}(1);`],
  })),
];

/** Groups the cases by probe file and renders each file's source with per-case line ranges. */
function buildProbes() {
  const files = new Map();
  for (const probeCase of CASES) {
    const relative = probeCase.path ?? DEFAULT_PROBE;
    const file = files.get(relative) ?? { source: [], ranges: [] };
    const first = file.source.length + 1;
    file.source.push(...probeCase.lines);
    file.ranges.push({ ...probeCase, first, last: file.source.length });
    files.set(relative, file);
  }
  return [...files].map(([relative, { source, ranges }]) => ({
    path: probeUrl(relative),
    text: [...source, "export {};", ""].join("\n"),
    ranges,
  }));
}

const probes = buildProbes();

function removeProbes() {
  for (const { path } of probes) {
    try {
      unlinkSync(path);
    } catch {
      // probe may not have been written
    }
  }
}

for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.on(signal, () => {
    removeProbes();
    process.exit(code);
  });
}

try {
  for (const { path, text } of probes) writeFileSync(path, text);
  const eslint = new ESLint({ ignore: false });
  let total = 0;
  for (const { path, ranges } of probes) {
    const [res] = await eslint.lintFiles([path]);
    const messages = res?.messages ?? [];
    total += ranges.length;
    const missing = ranges.filter(
      ({ rule, first, last }) =>
        !messages.some((m) => m.ruleId === rule && m.line >= first && m.line <= last),
    );
    for (const { name, rule } of missing) console.error(`✗ ${name}: ${rule} did not fire`);
    if (missing.length > 0) {
      for (const m of messages) {
        console.error(`  ${String(m.line)}: ${String(m.ruleId)}: ${m.message}`);
      }
      process.exitCode = 1;
    }
  }
  if (process.exitCode !== 1) console.log(`✓ core purity rules active (${String(total)} cases)`);
} finally {
  removeProbes();
}
