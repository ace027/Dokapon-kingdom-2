import { decisionHandlers, resolvePoll, resolveUnsupported } from "./decision";
import type { HandlerMap, ResolverTable } from "./shared";

/**
 * Reveal dispatch per decision kind. `combat/exchange` stays `resolveUnsupported` until 02-03
 * replaces it.
 */
const resolvers = {
  poll: resolvePoll,
  "combat/exchange": resolveUnsupported,
} satisfies ResolverTable;

/** The exhaustive handler map; later waves spread their handlers in here. */
export const handlers = { ...decisionHandlers(resolvers) } satisfies HandlerMap;
