import type { Action } from "./actions";
import type { GameEvent } from "./events";
import { createGame } from "./game";
import { reduce, type Reject } from "./reducer";
import type { GameSettings, GameState } from "./types";

export interface ReplayResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly rejections: readonly { index: number; error: Reject }[];
}

/** Folds `reduce` over `actions` from `createGame(settings)`; rejected actions are recorded and skipped. */
export function replay(settings: GameSettings, actions: readonly Action[]): ReplayResult {
  let state = createGame(settings);
  const events: GameEvent[] = [];
  const rejections: { index: number; error: Reject }[] = [];
  actions.forEach((action, index) => {
    const result = reduce(state, action);
    if (result.ok) {
      state = result.state;
      events.push(...result.events);
    } else {
      rejections.push({ index, error: result.error });
    }
  });
  return { state, events, rejections };
}
