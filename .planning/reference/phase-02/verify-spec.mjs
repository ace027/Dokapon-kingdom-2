// node .planning/reference/phase-02/verify-spec.mjs
// Checks that every golden pinned in the Phase 2 spec reproduces from this reference implementation
// AND from the spec text itself (content tables, TEST_RULES literal, action blocks). Exit 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { computeGoldens, SCENARIOS } from "./goldens.mjs";
import { rulesHash, stableStringify } from "./kernel.mjs";
import { RULES } from "./content-rules.mjs";
import { TEST_RULES } from "./spec-test-rules.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(here, "..", "..", "specs", "02-combat-core-balance-sim-spec.md");
const spec = fs.readFileSync(specPath, "utf8");
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { if (ok) pass++; else { fail++; console.log(`FAIL ${name}${detail ? ": " + detail : ""}`); } };

// 1. content tables in the spec -> Rules (parse-spec.py) must hash like the reference content rules
execFileSync("python3", [path.join(here, "parse-spec.py")]);
const specRules = JSON.parse(fs.readFileSync(path.join(here, "spec-rules.json"), "utf8"));
check("content tables → rulesHash", rulesHash(specRules) === rulesHash(RULES), `${rulesHash(specRules)} vs ${rulesHash(RULES)}`);
if (rulesHash(specRules) !== rulesHash(RULES)) {
  for (const k of Object.keys(RULES)) if (stableStringify(RULES[k]) !== stableStringify(specRules[k] ?? null)) console.log("  differs:", k);
}

// 2. TEST_RULES literal in the spec must equal spec-test-rules.mjs
{
  const i = spec.indexOf("export const TEST_RULES: Rules = {");
  const start = spec.lastIndexOf("```ts", i) + 5;
  const end = spec.indexOf("```", i);
  const src = spec.slice(start, end).replace("export const TEST_RULES: Rules =", "export const TEST_RULES =");
  const tmp = path.join(here, ".spec-test-rules.tmp.mjs");
  fs.writeFileSync(tmp, src);
  const m = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  fs.unlinkSync(tmp);
  check("TEST_RULES literal", rulesHash(m.TEST_RULES) === rulesHash(TEST_RULES), rulesHash(m.TEST_RULES));
}

// 3. action blocks in the spec must equal the reference scenarios
const markers = {
  "kernel-game": "**Golden (W1b, `packages/sim/fixtures/kernel-game.json`",
  "combat-golden": "**Combat golden (W2",
  "rewards-golden": "**Rewards/loadout golden",
  "combat-game": "**Sim combat fixture (W3",
};
for (const [name, marker] of Object.entries(markers)) {
  const i = spec.indexOf(marker);
  if (i < 0) { check(`marker ${name}`, false, marker); continue; }
  const j = spec.indexOf("```json", i) + 7, k = spec.indexOf("```", j);
  const acts = JSON.parse(spec.slice(j, k));
  check(`actions ${name}`, stableStringify(acts) === stableStringify(SCENARIOS[name].actions));
}

// 4. every golden snippet must appear verbatim in the spec; traces must match the committed files
const g = computeGoldens();
for (const [k, v] of Object.entries(g.snippets)) {
  if (typeof v !== "string") continue;
  check(`snippet ${k}`, spec.includes(v), v.split("\n")[0].slice(0, 100));
}
for (const [f, v] of Object.entries(g.traces)) {
  const p = path.join(here, "traces", f);
  const onDisk = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  check(`trace ${f}`, onDisk === JSON.stringify(v, null, 1) + "\n", "run gen-goldens.mjs");
}

// 5. gate requirement (D1) with margin
for (const r of g.snippets.gateRows) {
  check(`gate ${r.c} hard-decisive >= 0.75`, r.rate >= 0.75, r.rate.toFixed(3));
  check(`gate ${r.c} draw rate <= 0.35`, r.drawRate <= 0.35, r.drawRate.toFixed(3));
}

// 6. no stale pins from earlier revisions
for (const stale of ["94160b70", "60d64975"]) check(`no stale pin ${stale}`, !spec.split("## Revision History")[0].includes(stale));

console.log(`verify-spec: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
