import { isActionType, type Action } from "./actions";
import type { GameEvent } from "./events";
import { handlers, type Ctx, type Handler } from "./handlers";
import { nextInt, type RngState } from "./rng";
import { SCHEMA_VERSION, SYSTEM_ACTOR, type GameState, type PlayerId } from "./types";

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function fail(code: RejectCode, message: string): { ok: false; error: Reject } {
  return { ok: false, error: { code, message } };
}

/** Precedence steps 1–3: version, known type, shape. */
function checkShape(value: unknown): ShapeResult {
  if (!isPlainObject(value) || value.v !== SCHEMA_VERSION) {
    return fail("UNSUPPORTED_VERSION", `action must be a plain object with v=${SCHEMA_VERSION}`);
  }
  const type = value.type;
  if (!isActionType(type)) {
    return fail("UNKNOWN_ACTION", "unknown action type");
  }
  // safe: the handler map is exhaustive over Action['type'] and its guard verifies that the
  // payload matches `type`, so the handler is only ever called with its own action variant.
  const handler = handlers[type] as unknown as Handler<Action>;
  if (!handler.guard(value)) {
    return fail("INVALID_PAYLOAD", `invalid payload for ${type}`);
  }
  return { ok: true, action: value, handler };
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
      return state.public.players.includes(playerId);
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

/** Shape guard shared with `reduce` (precedence steps 1–3 only). */
export function isAction(value: unknown): value is Action {
  return checkShape(value).ok;
}

/**
 * Pure transition. Accepts untrusted input, never throws on bad actions and never mutates
 * `state`. Checks, first failure wins: version → type → shape → phase → actor → state validation.
 */
export function reduce(state: GameState, action: unknown): ReduceResult {
  const shape = checkShape(action);
  if (!shape.ok) return shape;
  const { action: a, handler } = shape;
  if (!handler.phases.includes(state.public.phase)) {
    return fail("WRONG_PHASE", `${a.type} is not allowed in phase ${state.public.phase}`);
  }
  if (!actorAllowed(handler.actor, state, a.playerId)) {
    return fail("WRONG_ACTOR", `${a.playerId} may not perform ${a.type}`);
  }
  const invalid = handler.validate?.(state, a) ?? null;
  if (invalid !== null) return { ok: false, error: invalid };
  const ctx = makeCtx(state.hidden.rng);
  const applied = handler.apply(state, a, ctx);
  return {
    ok: true,
    state: { ...applied.state, hidden: { ...applied.state.hidden, rng: ctx.rng } },
    events: applied.events,
  };
}
