import type { GameEvent } from "./events";
import type { SCHEMA_VERSION, PlayerId, PrivateState, PublicState, GameState } from "./types";
import { ownGet } from "./validation";

/**
 * Who a projection is for: a seated {@link PlayerId} or `'spectator'` (who sees public data only).
 * The spec writes this as `PlayerId | 'spectator'`; that union widens to `string`, so it is spelled
 * as the (identical) `PlayerId` alias to avoid a redundant-constituent lint suppression.
 */
export type Viewer = PlayerId;

/** Everything a single viewer may see. Never contains `hidden` or another player's `private`. */
export interface PlayerView {
  readonly v: typeof SCHEMA_VERSION;
  readonly viewer: Viewer;
  readonly public: PublicState;
  readonly self: PrivateState | null;
  /** Every seated player's bag and scroll COUNTS only (never contents), the viewer included. */
  readonly counts: Readonly<Record<PlayerId, { readonly bag: number; readonly scrolls: number }>>;
}

/**
 * Structural redaction: builds a new object from the public partition plus the viewer's own
 * private partition, plus bag/scroll counts. `state` is never spread, so `hidden` and other
 * players' data cannot leak. Spectators and ids that are not seated players get `self: null`.
 */
export function viewFor(state: GameState, viewer: Viewer): PlayerView {
  const self = state.public.players.includes(viewer)
    ? (ownGet(state.private, viewer) ?? null)
    : null;
  const counts = Object.fromEntries(
    state.public.players.map((id): [string, { bag: number; scrolls: number }] => {
      const priv = ownGet(state.private, id);
      return [id, { bag: priv?.bag.length ?? 0, scrolls: priv?.scrolls.length ?? 0 }];
    }),
  );
  return { v: state.v, viewer, public: state.public, self, counts };
}

/** Returns `event` if `viewer` may see it, otherwise `null`. Spectators see public events only. */
export function redactEvent(event: GameEvent, viewer: Viewer): GameEvent | null {
  if (event.visibility.kind === "public") return event;
  if (viewer !== "spectator" && event.visibility.ids.includes(viewer)) return event;
  return null;
}

/** The subsequence of `events` visible to `viewer`, in order. Does not mutate `events`. */
export function eventsFor(events: readonly GameEvent[], viewer: Viewer): GameEvent[] {
  return events
    .map((event) => redactEvent(event, viewer))
    .filter((event): event is GameEvent => event !== null);
}
