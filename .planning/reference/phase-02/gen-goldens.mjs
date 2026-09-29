// node gen-goldens.mjs [--no-gate]  → prints every golden snippet and (re)writes traces/*.json
import fs from "node:fs";
import { computeGoldens } from "./goldens.mjs";
const here = new URL(".", import.meta.url).pathname;
const g = computeGoldens({ withGate: !process.argv.includes("--no-gate") });
for (const [k, v] of Object.entries(g.snippets)) console.log(`=== ${k}\n${typeof v === "string" ? v : JSON.stringify(v)}\n`);
for (const k of ["combat-golden", "rewards-golden", "combat-game"]) {
  const s = g.summaries[k];
  console.log(`=== ${k}.details\nfirsts: ${s.firsts}\nhidden: ${s.hidden}\nchoiceHistory: ${s.choiceHistory}\nchars: ${JSON.stringify(s.characters)}\nrewards: ${s.rewards}\n`);
}
fs.mkdirSync(here + "traces", { recursive: true });
for (const [f, v] of Object.entries(g.traces)) fs.writeFileSync(here + "traces/" + f, JSON.stringify(v, null, 1) + "\n");
console.error("traces written:", Object.keys(g.traces).join(", "));
