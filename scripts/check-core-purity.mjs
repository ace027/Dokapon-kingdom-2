// Negative probe: proves the core purity lint rules actually fire.
// Writes a deliberately impure file into packages/core/src, lints it, and asserts that every
// case below is reported by its expected rule on its own lines. Always removes the probe,
// including on SIGINT/SIGTERM.
import { unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const probePath = fileURLToPath(
  new URL("../packages/core/src/__purity_probe__.ts", import.meta.url),
);

/** Each case's lines are linted in place; `rule` must report on one of them. */
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
];

function buildProbe() {
  const source = [];
  const ranges = [];
  for (const probeCase of CASES) {
    const first = source.length + 1;
    source.push(...probeCase.lines);
    ranges.push({ ...probeCase, first, last: source.length });
  }
  source.push("export {};", "");
  return { text: source.join("\n"), ranges };
}

function removeProbe() {
  try {
    unlinkSync(probePath);
  } catch {
    // probe may not have been written
  }
}

for (const [signal, code] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
]) {
  process.on(signal, () => {
    removeProbe();
    process.exit(code);
  });
}

try {
  const { text, ranges } = buildProbe();
  writeFileSync(probePath, text);
  const eslint = new ESLint({ ignore: false });
  const [res] = await eslint.lintFiles([probePath]);
  const messages = res?.messages ?? [];
  const missing = ranges.filter(
    ({ rule, first, last }) =>
      !messages.some((m) => m.ruleId === rule && m.line >= first && m.line <= last),
  );
  if (missing.length === 0) {
    console.log(`✓ core purity rules active (${String(ranges.length)} cases)`);
  } else {
    for (const { name, rule } of missing) console.error(`✗ ${name}: ${rule} did not fire`);
    for (const m of messages) {
      console.error(`  ${String(m.line)}: ${String(m.ruleId)}: ${m.message}`);
    }
    process.exitCode = 1;
  }
} finally {
  removeProbe();
}
