import type { z } from "zod";
import { ClassesFileSchema } from "./schemas/classes";
import { GearFileSchema } from "./schemas/gear";
import { ItemsFileSchema } from "./schemas/items";
import { MonstersFileSchema } from "./schemas/monsters";
import { SpellsFileSchema } from "./schemas/spells";
import { TuningFileSchema } from "./schemas/tuning";

/** Maps each data file (relative to the data dir) to the schema it must satisfy. */
export const CONTENT_REGISTRY = {
  "classes.json": ClassesFileSchema,
  "gear.json": GearFileSchema,
  "items.json": ItemsFileSchema,
  "monsters.json": MonstersFileSchema,
  "spells.json": SpellsFileSchema,
  "tuning.json": TuningFileSchema,
} as const satisfies Record<string, z.ZodType>;

/** Every registered file must be present in the data dir. Sorted for deterministic output. */
export const REQUIRED_FILES: readonly string[] = Object.keys(CONTENT_REGISTRY).sort();
