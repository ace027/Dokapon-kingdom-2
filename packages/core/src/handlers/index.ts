import { combatStartHandler, resolveCombatExchange } from "./combat";
import { decisionHandlers, resolvePoll } from "./decision";
import type { HandlerMap, ResolverTable } from "./shared";
import { setCharacterHandler } from "./system";

/** Reveal dispatch per decision kind. */
const resolvers = {
  poll: resolvePoll,
  "combat/exchange": resolveCombatExchange,
} satisfies ResolverTable;

/** The exhaustive handler map; later waves spread their handlers in here. */
export const handlers = {
  ...decisionHandlers(resolvers),
  "combat/start": combatStartHandler,
  "system/setCharacter": setCharacterHandler,
} satisfies HandlerMap;
