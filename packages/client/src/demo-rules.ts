import { buildShippedRules } from "@usurpia/content/shipped";

/** The demo runs on the real shipped content (same `buildRules` as the Node loader), not a copy. */
export const DEMO_RULES = buildShippedRules();
