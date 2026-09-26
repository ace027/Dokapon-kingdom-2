// Browser-safe entry point. The Node-only loader lives in ./load and is intentionally not exported here.
export { IdSchema } from "./schemas/common";
export { ItemSchema, ItemsFileSchema, type Item } from "./schemas/items";
export { CONTENT_REGISTRY, REQUIRED_FILES } from "./registry";
export { validateContent, type ContentEntry, type ContentError } from "./validate";
