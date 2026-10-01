// The generic multi-player decision module: `decision/open` (kind `poll`), `decision/commit`,
// `timeout`, and the shared `openDecision` / `revealDecision` steps that the combat handlers reuse.
// Every record keyed by a player id is built with `Object.fromEntries` and read with `ownGet`
// (PIT-002), so ids such as `toString` never touch `Object.prototype`.
import type { ActionOf, Ctx, Handler, HandlerMap, Resolver, ResolverTable } from "./shared";
import {
  hasExactKeys,
  isChoiceToken,
  isEnvelope,
  isTokenArray,
  ownGet,
  overflow,
  reject,
} from "./shared";
import { clip, isPlainObject, isUnique } from "../validation";
import { onlyPlayers, PUBLIC, type GameEvent } from "../events";
import { COMMANDS, type Command, type Rules } from "../rules";
import {
  MAX_COUNTER,
  SCHEMA_VERSION,
  type CommandCounts,
  type DecisionKind,
  type GameState,
  type PlayerId,
  type PrivateState,
  type Prompt,
} from "../types";

/** One player's prompt when a decision is opened. */
export interface PromptSpec {
  readonly playerId: PlayerId;
  readonly options: readonly string[];
  readonly default: string;
}

type OpenAction = ActionOf<"decision/open">;
type CommitAction = ActionOf<"decision/commit">;
type TimeoutAction = ActionOf<"timeout">;

const MAX_PROMPTS = 4;
const MAX_POLL_OPTIONS = 8;
const PROMPT_KEYS = ["playerId", "options", "default"] as const;

function isCommand(choice: string): choice is Command {
  return COMMANDS.some((command) => command === choice);
}

/** Replaces the `prompt` of the listed players; every other private partition is kept as is. */
function withPrompts(
  state: GameState,
  prompts: ReadonlyMap<PlayerId, Prompt | null>,
): GameState["private"] {
  return Object.fromEntries(
    Object.entries(state.private).map(([id, priv]): [string, PrivateState] => {
      const prompt = prompts.get(id);
      return [id, prompt === undefined ? priv : { ...priv, prompt }];
    }),
  );
}

/**
 * Opens a decision: `decisionSeq += 1`, `id = "d" + decisionSeq`, the public `pending`, the hidden
 * `decision` and each listed player's private `prompt` (options copied), phase `decision`. Emits
 * `DecisionOpened`, then one players-only `PromptOpened` per prompt in order.
 */
export function openDecision(
  state: GameState,
  kind: DecisionKind,
  prompts: readonly PromptSpec[],
  events: GameEvent[],
): GameState {
  const decisionSeq = state.hidden.decisionSeq + 1;
  const id = `d${decisionSeq}`;
  const required = prompts.map((p) => p.playerId);
  const promptById = new Map<PlayerId, Prompt | null>(
    prompts.map((p): [PlayerId, Prompt] => [
      p.playerId,
      { decisionId: id, options: [...p.options], default: p.default },
    ]),
  );
  events.push({
    v: SCHEMA_VERSION,
    type: "DecisionOpened",
    visibility: PUBLIC,
    decisionId: id,
    kind,
    required,
  });
  for (const p of prompts) {
    events.push({
      v: SCHEMA_VERSION,
      type: "PromptOpened",
      visibility: onlyPlayers([p.playerId]),
      decisionId: id,
      playerId: p.playerId,
      options: [...p.options],
      default: p.default,
    });
  }
  return {
    ...state,
    public: {
      ...state.public,
      phase: "decision",
      pending: { id, kind, required, committed: [] },
    },
    private: withPrompts(state, promptById),
    hidden: { ...state.hidden, decisionSeq, decision: { id, choices: {} } },
  };
}

/** Each required player's revealed choice: the committed one, else their own prompt default. */
function revealedChoices(
  state: GameState,
  required: readonly PlayerId[],
  committed: Readonly<Record<PlayerId, string>>,
): Record<PlayerId, string> {
  return Object.fromEntries(
    required.map((id): [string, string] => {
      const choice = ownGet(committed, id) ?? ownGet(state.private, id)?.prompt?.default;
      if (choice === undefined) throw new Error(`invariant: no choice or default for ${clip(id)}`);
      return [id, choice];
    }),
  );
}

/** Adds one to each counted command of the listed players, saturating at `MAX_COUNTER`. */
function countCommands(
  history: Readonly<Record<PlayerId, CommandCounts>>,
  choices: Readonly<Record<PlayerId, string>>,
  counted: readonly PlayerId[],
): Readonly<Record<PlayerId, CommandCounts>> {
  return Object.fromEntries(
    Object.entries(history).map(([id, counts]): [string, CommandCounts] => {
      const choice = counted.includes(id) ? ownGet(choices, id) : undefined;
      if (choice === undefined || !isCommand(choice)) return [id, counts];
      return [id, { ...counts, [choice]: Math.min(MAX_COUNTER, counts[choice] + 1) }];
    }),
  );
}

/**
 * Reveals the open decision: builds `choices` in `required` order (committed choice, else the
 * player's own default), sets `lastReveal`, clears `pending`, `hidden.decision` and the required
 * players' prompts, returns to phase `turn` and emits `ChoicesRevealed`. For `combat/exchange`
 * each non-timed-out player's choice that is one of the six commands is counted in
 * `choiceHistory`. Finally `resolvers[kind]` applies the decision. Returns `state` unchanged when
 * no decision is open.
 */
export function revealDecision(
  state: GameState,
  timedOut: readonly PlayerId[],
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
  resolvers: ResolverTable,
): GameState {
  const { pending } = state.public;
  const open = state.hidden.decision;
  if (pending === null || open === null) return state;
  const choices = revealedChoices(state, pending.required, open.choices);
  const counted =
    pending.kind === "combat/exchange"
      ? pending.required.filter((id) => !timedOut.includes(id))
      : [];
  events.push({
    v: SCHEMA_VERSION,
    type: "ChoicesRevealed",
    visibility: PUBLIC,
    decisionId: pending.id,
    kind: pending.kind,
    choices: { ...choices },
    timedOut: [...timedOut],
  });
  const revealed: GameState = {
    ...state,
    public: {
      ...state.public,
      phase: "turn",
      pending: null,
      lastReveal: {
        decisionId: pending.id,
        kind: pending.kind,
        choices,
        timedOut: [...timedOut],
      },
      choiceHistory: countCommands(state.public.choiceHistory, choices, counted),
    },
    private: withPrompts(
      state,
      new Map(pending.required.map((id): [PlayerId, null] => [id, null])),
    ),
    hidden: { ...state.hidden, decision: null },
  };
  return resolvers[pending.kind](revealed, choices, ctx, rules, events);
}

/** The `poll` resolver: a poll only records its reveal, so the state is returned unchanged. */
export const resolvePoll: Resolver = (state) => state;

function isOpenAction(raw: Record<string, unknown>): raw is OpenAction {
  if (!hasExactKeys(raw, ["v", "type", "playerId", "prompts"])) return false;
  if (!isEnvelope(raw, "decision/open")) return false;
  const prompts: unknown = raw.prompts;
  if (!Array.isArray(prompts) || prompts.length < 1 || prompts.length > MAX_PROMPTS) return false;
  return prompts.every(
    (prompt: unknown) =>
      isPlainObject(prompt) &&
      hasExactKeys(prompt, PROMPT_KEYS) &&
      typeof prompt.playerId === "string" &&
      isTokenArray(prompt.options, 1, MAX_POLL_OPTIONS) &&
      isChoiceToken(prompt.default),
  );
}

function isCommitAction(raw: Record<string, unknown>): raw is CommitAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "decisionId", "choice"]) &&
    isEnvelope(raw, "decision/commit") &&
    typeof raw.decisionId === "string" &&
    isChoiceToken(raw.choice)
  );
}

function isTimeoutAction(raw: Record<string, unknown>): raw is TimeoutAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "decisionId"]) &&
    isEnvelope(raw, "timeout") &&
    typeof raw.decisionId === "string"
  );
}

/** `STALE_DECISION` unless `decisionId` names the open decision. */
function staleError(state: GameState, decisionId: string) {
  return state.public.pending?.id === decisionId
    ? null
    : reject("STALE_DECISION", `decision ${clip(decisionId)} is not the open decision`);
}

/**
 * The three decision handlers. The resolver table is injected by `handlers/index.ts`, so there is
 * no mutable module-level registry.
 */
export function decisionHandlers(
  resolvers: ResolverTable,
): Pick<HandlerMap, "decision/open" | "decision/commit" | "timeout"> {
  const open: Handler<OpenAction> = {
    phases: ["turn"],
    actor: "system",
    guard: isOpenAction,
    validate: (state, a) => {
      const ids = a.prompts.map((p) => p.playerId);
      if (!isUnique(ids)) return reject("INVALID_PAYLOAD", "prompt players must be unique");
      if (!ids.every((id) => state.public.players.includes(id))) {
        return reject("INVALID_PAYLOAD", "prompt player must be seated");
      }
      if (!a.prompts.every((p) => isUnique(p.options))) {
        return reject("INVALID_PAYLOAD", "prompt options must be unique");
      }
      if (!a.prompts.every((p) => p.options.includes(p.default))) {
        return reject("INVALID_PAYLOAD", "prompt default must be one of its options");
      }
      if (overflow(state.hidden.decisionSeq, 1)) {
        return reject("INVALID_PAYLOAD", "decisionSeq would exceed MAX_COUNTER");
      }
      return null;
    },
    apply: (state, a) => {
      const events: GameEvent[] = [];
      return { state: openDecision(state, "poll", a.prompts, events), events };
    },
  };

  const commit: Handler<CommitAction> = {
    phases: ["decision"],
    actor: "required",
    guard: isCommitAction,
    validate: (state, a) => {
      const stale = staleError(state, a.decisionId);
      if (stale !== null) return stale;
      if (state.public.pending?.committed.includes(a.playerId) === true) {
        return reject("ALREADY_COMMITTED", `${clip(a.playerId)} already committed`);
      }
      if (ownGet(state.private, a.playerId)?.prompt?.options.includes(a.choice) !== true) {
        return reject("INVALID_PAYLOAD", "choice is not one of your options");
      }
      return null;
    },
    apply: (state, a, ctx, rules) => {
      const { pending } = state.public;
      const open = state.hidden.decision;
      if (pending === null || open === null) return { state, events: [] };
      const events: GameEvent[] = [
        {
          v: SCHEMA_VERSION,
          type: "ChoiceCommitted",
          visibility: PUBLIC,
          decisionId: pending.id,
          playerId: a.playerId,
        },
      ];
      const committed = [...pending.committed, a.playerId];
      const choices = Object.fromEntries([...Object.entries(open.choices), [a.playerId, a.choice]]);
      const next: GameState = {
        ...state,
        public: { ...state.public, pending: { ...pending, committed } },
        hidden: { ...state.hidden, decision: { id: open.id, choices } },
      };
      if (committed.length < pending.required.length) return { state: next, events };
      return { state: revealDecision(next, [], ctx, rules, events, resolvers), events };
    },
  };

  const timeout: Handler<TimeoutAction> = {
    phases: ["decision"],
    actor: "system",
    guard: isTimeoutAction,
    validate: (state, a) => staleError(state, a.decisionId),
    apply: (state, _a, ctx, rules) => {
      const { pending } = state.public;
      if (pending === null) return { state, events: [] };
      const missing = pending.required.filter((id) => !pending.committed.includes(id));
      const events: GameEvent[] = missing.map((id): GameEvent => ({
        v: SCHEMA_VERSION,
        type: "ChoiceTimedOut",
        visibility: PUBLIC,
        decisionId: pending.id,
        playerId: id,
      }));
      return { state: revealDecision(state, missing, ctx, rules, events, resolvers), events };
    },
  };

  return { "decision/open": open, "decision/commit": commit, timeout };
}
