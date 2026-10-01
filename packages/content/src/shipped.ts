// Browser-safe entry point (package export "./shipped"): the shipped data files bundled as JSON
// modules (no `node:fs`), for consumers that cannot read the data dir at run time (the client).
import type { Rules } from "@usurpia/core";
import classes from "../data/classes.json";
import gear from "../data/gear.json";
import items from "../data/items.json";
import monsters from "../data/monsters.json";
import spells from "../data/spells.json";
import tuning from "../data/tuning.json";
import { buildRules } from "./build-rules";
import type { ContentEntry } from "./validate";

/** The six shipped data files, in the order `loadContentDir` returns them (sorted by name). */
export const SHIPPED_ENTRIES: readonly ContentEntry[] = [
  { file: "classes.json", data: classes },
  { file: "gear.json", data: gear },
  { file: "items.json", data: items },
  { file: "monsters.json", data: monsters },
  { file: "spells.json", data: spells },
  { file: "tuning.json", data: tuning },
];

/** `Rules` built from the shipped data through the same `buildRules` as the Node loader. */
export function buildShippedRules(): Rules {
  const result = buildRules(SHIPPED_ENTRIES);
  if (!result.ok) {
    const lines = result.errors.map((e) => `${e.file} ${e.path}: ${e.message}`);
    throw new Error(["content invalid:", ...lines].join("\n"));
  }
  return result.rules;
}
