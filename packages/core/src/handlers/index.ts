import { combatStartHandler, resolveCombatExchange } from "./combat";
import { decisionHandlers, resolvePoll } from "./decision";
import type { HandlerMap, ResolverTable } from "./shared";
import {
  discardHandler,
  grantHandler,
  setPortableHandler,
  switchClassHandler,
  useItemHandler,
} from "./loadout";
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
  "system/grant": grantHandler,
  "loadout/switchClass": switchClassHandler,
  "loadout/discard": discardHandler,
  "loadout/useItem": useItemHandler,
  "loadout/setPortable": setPortableHandler,
} satisfies HandlerMap;
