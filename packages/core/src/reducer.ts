import type { Action } from "./actions";
import type { GameEvent } from "./events";
import { handlers } from "./handlers/index";
import type { Ctx, Handler } from "./handlers/shared";
import { nextInt, type RngState } from "./rng";
import type { Rules } from "./rules";
import { stableStringify } from "./canonical";
import { SCHEMA_VERSION, SYSTEM_ACTOR, type GameState, type PlayerId } from "./types";
import { clip, isPlainObject } from "./validation";

export type RejectCode =
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_ACTION"
  | "WRONG_ACTOR"
  | "WRONG_PHASE"
  | "INVALID_PAYLOAD"
  | "STALE_DECISION"
  | "ALREADY_COMMITTED";

export interface Reject {
  readonly code: RejectCode;
  readonly message: string;
}

export type ReduceResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: Reject };

type ShapeResult =
  { ok: true; action: Action; handler: Handler<Action> } | { ok: false; error: Reject };

function fail(code: RejectCode, message: string): { ok: false; error: Reject } {
  return { ok: false, error: { code, message } };
}

/** Plain-object test that cannot throw (a Proxy's `getPrototypeOf` trap may). Reads no properties. */
function isPlainObjectSafe(value: unknown): boolean {
  try {
    return isPlainObject(value);
  } catch {
    return false;
  }
}

/**
 * Reads untrusted input exactly once into a canonical JSON copy, so getters, Proxies and sparse
 * arrays cannot answer differently to later checks. Anything that is not canonical JSON is rejected.
 */
function canonicalize(value: unknown): { ok: true; raw: unknown } | { ok: false; error: Reject } {
  try {
    return { ok: true, raw: JSON.parse(stableStringify(value)) };
  } catch {
    return isPlainObjectSafe(value)
      ? fail("INVALID_PAYLOAD", "action is not canonical JSON")
      : fail("UNSUPPORTED_VERSION", `action must be a plain object with v=${SCHEMA_VERSION}`);
  }
}

/** Precedence steps 1–3: version, known type, shape. Works only on the canonical copy. */
function checkShape(value: unknown): ShapeResult {
  const canonical = canonicalize(value);
  if (!canonical.ok) return canonical;
  const raw = canonical.raw;
  if (!isPlainObject(raw) || raw.v !== SCHEMA_VERSION) {
    return fail("UNSUPPORTED_VERSION", `action must be a plain object with v=${SCHEMA_VERSION}`);
  }
  const type: string = typeof raw.type === "string" ? raw.type : "";
  if (!Object.hasOwn(handlers, type)) {
    return fail("UNKNOWN_ACTION", "unknown action type");
  }
  // safe: the handler map is exhaustive over Action['type'] and its guard verifies that the
  // payload matches `type`, so the handler is only ever called with its own action variant.
  const handler = (handlers as Readonly<Record<string, Handler<Action> | undefined>>)[type];
  if (handler === undefined) return fail("UNKNOWN_ACTION", "unknown action type");
  if (!handler.guard(raw)) {
    return fail("INVALID_PAYLOAD", `invalid payload for ${type}`);
  }
  return { ok: true, action: raw, handler };
}

function actorAllowed(
  rule: Handler<Action>["actor"],
  state: GameState,
  playerId: PlayerId,
): boolean {
  switch (rule) {
    case "active":
      return playerId === state.public.activePlayer;
    case "any-player":
      return Array.isArray(state.public.players) && state.public.players.includes(playerId);
    case "system":
      return playerId === SYSTEM_ACTOR;
    case "required":
      return state.public.pending?.required.includes(playerId) ?? false;
  }
}

function makeCtx(rng: RngState): Ctx {
  const ctx: Ctx = {
    rng,
    int: (min, max) => {
      const [value, next] = nextInt(ctx.rng, min, max);
      ctx.rng = next;
      return value;
    },
  };
  return ctx;
}

/** Shape guard shared with `reduce` (precedence steps 1–3 only, on the same canonical copy). */
export function isAction(value: unknown): value is Action {
  return checkShape(value).ok;
}

/**
 * Pure transition. Accepts untrusted input, never throws on bad actions and never mutates
 * `state`. `action` is first canonicalized (read once), then checked, first failure wins:
 * version → type → shape → phase → actor → state validation.
 *
 * Trust boundary: `reduce` TRUSTS the `playerId` inside the action. It has no notion of who sent
 * it, so a host or server must never pass a client-supplied action straight to it (a client could
 * claim `playerId: "system"` or another player's id). Host/server-internal code (the sim, replay,
 * tests, the server's own system actions) uses `reduce`; anything that arrives from a client goes
 * through {@link reduceAs} with the authenticated actor.
 */
export function reduce(state: GameState, action: unknown, rules: Rules): ReduceResult {
  const shape = checkShape(action);
  if (!shape.ok) return shape;
  const { action: a, handler } = shape;
  const { type, playerId } = a;
  if (!handler.phases.includes(state.public.phase)) {
    return fail("WRONG_PHASE", `${type} is not allowed in phase ${state.public.phase}`);
  }
  if (!actorAllowed(handler.actor, state, playerId)) {
    return fail("WRONG_ACTOR", `${clip(playerId)} may not perform ${type}`);
  }
  const invalid = handler.validate?.(state, a, rules) ?? null;
  if (invalid !== null) return { ok: false, error: invalid };
  const ctx = makeCtx(state.hidden.rng);
  const applied = handler.apply(state, a, ctx, rules);
  return {
    ok: true,
    state: { ...applied.state, hidden: { ...applied.state.hidden, rng: ctx.rng } },
    events: applied.events,
  };
}

/**
 * `reduce` for actions submitted by an authenticated actor (a connected client, or the host acting
 * as `"system"`). `actor` must come from the transport's authentication, never from the action.
 * The action is canonicalized and shape-checked exactly as in `reduce` (so malformed input gets the
 * same version/type/shape rejects), then rejected with `WRONG_ACTOR` unless `action.playerId ===
 * actor`. That also means a `system` action (`playerId: "system"`) is accepted only when `actor` is
 * `"system"`. Everything else is delegated to `reduce`.
 */
export function reduceAs(
  state: GameState,
  action: unknown,
  rules: Rules,
  actor: PlayerId,
): ReduceResult {
  const shape = checkShape(action);
  if (!shape.ok) return shape;
  if (shape.action.playerId !== actor) {
    return fail("WRONG_ACTOR", "action playerId does not match the authenticated actor");
  }
  return reduce(state, shape.action, rules);
}
