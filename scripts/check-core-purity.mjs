// Negative probe: proves the core purity lint rules actually fire.
// Writes a deliberately impure file into packages/core/src, lints it, and
// asserts each restriction rule reports at least once. Always removes the probe.
import { unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";

const REQUIRED_RULES = [
  "no-restricted-properties",
  "no-restricted-globals",
  "no-restricted-imports",
];

const probePath = fileURLToPath(
  new URL("../packages/core/src/__purity_probe__.ts", import.meta.url),
);
const probeSource = [
  'import { readFileSync } from "node:fs";',
  "export const probe = [Math.random(), Date.now(), readFileSync];",
  "",
].join("\n");

try {
  writeFileSync(probePath, probeSource);
  const eslint = new ESLint({ ignore: false });
  const [res] = await eslint.lintFiles([probePath]);
  const fired = new Set((res?.messages ?? []).map((m) => m.ruleId));
  const missing = REQUIRED_RULES.filter((rule) => !fired.has(rule));
  if (missing.length === 0) {
    console.log("✓ core purity rules active");
  } else {
    console.error(`✗ core purity rules did not fire: ${missing.join(", ")}`);
    for (const m of res?.messages ?? []) {
      console.error(`  ${String(m.ruleId)}: ${m.message}`);
    }
    process.exitCode = 1;
  }
} finally {
  try {
    unlinkSync(probePath);
  } catch {
    // probe may not have been written
  }
}
