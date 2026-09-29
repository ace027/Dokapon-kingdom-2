// Browser-safe entry point. The Node-only loader lives in ./node and is intentionally not exported here.
export { IdSchema } from "./schemas/common";
export { ClassesFileSchema } from "./schemas/classes";
export { GearFileSchema } from "./schemas/gear";
export { ItemsFileSchema } from "./schemas/items";
export { SpellsFileSchema } from "./schemas/spells";
export { MonstersFileSchema } from "./schemas/monsters";
export { TuningFileSchema } from "./schemas/tuning";
export { CONTENT_REGISTRY, REQUIRED_FILES } from "./registry";
export { validateContent, type ContentEntry, type ContentError } from "./validate";
export { buildRules, type BuildResult } from "./build-rules";
