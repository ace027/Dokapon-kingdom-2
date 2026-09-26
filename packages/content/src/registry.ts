import type { z } from "zod";
import { ItemsFileSchema } from "./schemas/items";

/** Maps each data file (relative to the data dir) to the schema it must satisfy. */
export const CONTENT_REGISTRY = {
  "items.json": ItemsFileSchema,
} as const satisfies Record<string, z.ZodType>;

/** Every registered file must be present in the data dir. Sorted for deterministic output. */
export const REQUIRED_FILES: readonly string[] = Object.keys(CONTENT_REGISTRY).sort();
