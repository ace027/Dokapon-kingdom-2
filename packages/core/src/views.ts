import type { GameEvent } from "./events";
import type { SCHEMA_VERSION, PlayerId, PrivateState, PublicState, GameState } from "./types";

/** Who a projection is for: a seated player or a spectator (who sees public data only). */
// Spec contract: the union documents the `spectator` viewer even though it widens to string.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Viewer = PlayerId | "spectator";

/** Everything a single viewer may see. Never contains `hidden` or another player's `private`. */
export interface PlayerView {
  readonly v: typeof SCHEMA_VERSION;
  readonly viewer: Viewer;
  readonly public: PublicState;
  readonly self: PrivateState | null;
}

/**
 * Structural redaction: builds a new object from the public partition plus the viewer's own
 * private partition. `state` is never spread, so `hidden` and other players' data cannot leak.
 * Spectators and ids that are not seated players get `self: null`.
 */
export function viewFor(state: GameState, viewer: Viewer): PlayerView {
  const self =
    state.public.players.includes(viewer) && Object.hasOwn(state.private, viewer)
      ? (state.private[viewer] ?? null)
      : null;
  return { v: state.v, viewer, public: state.public, self };
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
