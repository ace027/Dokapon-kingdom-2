import type { Action } from "./actions";
import { PUBLIC, onlyPlayers, type GameEvent } from "./events";
import type { Reject } from "./reducer";
import type { RngState } from "./rng";
import type { Choice, GameState, Phase, PlayerId } from "./types";
import { clip, isChoice, isPlainObject, isStringArray, isUnique, ownGet } from "./validation";

/** Handler-local randomness. `int` draws via `nextInt` and advances `rng`. */
export interface Ctx {
  rng: RngState;
  int(min: number, max: number): number;
}

export interface Handler<A extends Action> {
  phases: readonly Phase[];
  actor: "active" | "any-player" | "system" | "required";
  /** State-independent shape check (spec precedence step 3). */
  guard: (raw: Record<string, unknown>) => raw is A;
  /** State-dependent validation (step 6); `null` means valid. */
  validate?: (s: GameState, a: A) => Reject | null;
  apply: (s: GameState, a: A, ctx: Ctx) => { state: GameState; events: GameEvent[] };
}

type ActionOf<K extends Action["type"]> = Extract<Action, { type: K }>;

const BASE_KEYS = ["v", "type", "playerId"] as const;
const MAX_NOTE_LENGTH = 64;
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10;

function isIntInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function hasExactKeys(raw: Record<string, unknown>, extra: readonly string[]): boolean {
  const keys = [...BASE_KEYS, ...extra];
  const own = Object.keys(raw);
  return own.length === keys.length && keys.every((key) => Object.hasOwn(raw, key));
}

function hasBase(raw: Record<string, unknown>, type: Action["type"]): boolean {
  return raw.v === 1 && raw.type === type && typeof raw.playerId === "string";
}

function reject(code: Reject["code"], message: string): Reject {
  return { code, message };
}

/**
 * The open decision's public and hidden halves, or null if they are missing, malformed or
 * disagree. Tolerates a malformed in-memory state (`== null`, array checks) so that `reduce`
 * rejects with STALE_DECISION / WRONG_ACTOR instead of throwing.
 */
export function openDecision(s: GameState) {
  const pending = s.public.pending as GameState["public"]["pending"] | undefined;
  const decision = s.hidden.decision as GameState["hidden"]["decision"] | undefined;
  if (pending == null || decision == null) return null;
  if (typeof pending.id !== "string" || decision.id !== pending.id) return null;
  if (!Array.isArray(pending.required) || !Array.isArray(pending.committed)) return null;
  if (!isPlainObject(decision.choices)) return null;
  return { pending, decision };
}

function requireOpenDecision(s: GameState) {
  const open = openDecision(s);
  if (open === null) {
    // Unreachable: `validate` rejects with STALE_DECISION before `apply` runs.
    throw new Error("invariant: no open decision");
  }
  return open;
}

function staleDecision(s: GameState, decisionId: string): Reject | null {
  const open = openDecision(s);
  return open?.pending.id === decisionId
    ? null
    : reject("STALE_DECISION", `decision ${clip(decisionId)} is not the open decision`);
}

/**
 * Choices keyed in `required` order (stableStringify sorts anyway). Lookups are own-property
 * only, so an id like `toString` gets its committed choice or `fallback`, never a prototype
 * member; `fromEntries` defines own data properties, so no id reaches a prototype setter.
 */
function orderedChoices(
  required: readonly PlayerId[],
  choices: Readonly<Record<PlayerId, Choice>>,
  fallback: Choice,
): Record<PlayerId, Choice> {
  return Object.fromEntries(
    required.map((p): [PlayerId, Choice] => [p, ownGet(choices, p) ?? fallback]),
  );
}

/** Reveal: emit ChoicesRevealed, set lastReveal, clear pending/decision, return to 'turn'. */
function reveal(
  s: GameState,
  decisionId: string,
  choices: Readonly<Record<PlayerId, Choice>>,
  timedOut: readonly PlayerId[],
): { state: GameState; event: GameEvent } {
  return {
    state: {
      ...s,
      public: {
        ...s.public,
        phase: "turn",
        pending: null,
        lastReveal: { decisionId, choices, timedOut },
      },
      hidden: { ...s.hidden, decision: null },
    },
    event: { v: 1, type: "ChoicesRevealed", visibility: PUBLIC, decisionId, choices, timedOut },
  };
}

export const handlers = {
  "sample/increment": {
    phases: ["turn"],
    actor: "active",
    guard: (raw): raw is ActionOf<"sample/increment"> =>
      hasBase(raw, "sample/increment") &&
      hasExactKeys(raw, ["amount"]) &&
      isIntInRange(raw.amount, MIN_AMOUNT, MAX_AMOUNT),
    apply: (s, a) => {
      const counter = s.public.counter + a.amount;
      return {
        state: { ...s, public: { ...s.public, counter } },
        events: [
          {
            v: 1,
            type: "CounterIncremented",
            visibility: PUBLIC,
            playerId: a.playerId,
            amount: a.amount,
            counter,
          },
        ],
      };
    },
  },

  "sample/roll": {
    phases: ["turn"],
    actor: "active",
    guard: (raw): raw is ActionOf<"sample/roll"> =>
      hasBase(raw, "sample/roll") && hasExactKeys(raw, []),
    apply: (s, a, ctx) => {
      const value = ctx.int(1, 6);
      const { activePlayer } = s.public;
      const players: readonly PlayerId[] = Array.isArray(s.public.players) ? s.public.players : [];
      const nextPlayer = players[(players.indexOf(activePlayer) + 1) % players.length];
      const turn = s.public.turn + 1;
      const nextActive = nextPlayer ?? activePlayer;
      return {
        state: {
          ...s,
          public: {
            ...s.public,
            lastRoll: { playerId: a.playerId, value },
            activePlayer: nextActive,
            turn,
          },
        },
        events: [
          { v: 1, type: "Rolled", visibility: PUBLIC, playerId: a.playerId, value },
          { v: 1, type: "TurnAdvanced", visibility: PUBLIC, activePlayer: nextActive, turn },
        ],
      };
    },
  },

  "sample/setSecret": {
    phases: ["turn", "decision"],
    actor: "any-player",
    guard: (raw): raw is ActionOf<"sample/setSecret"> =>
      hasBase(raw, "sample/setSecret") &&
      hasExactKeys(raw, ["note"]) &&
      typeof raw.note === "string" &&
      raw.note.length <= MAX_NOTE_LENGTH,
    apply: (s, a) => ({
      state: { ...s, private: { ...s.private, [a.playerId]: { note: a.note } } },
      events: [
        {
          v: 1,
          type: "SecretSet",
          visibility: onlyPlayers([a.playerId]),
          playerId: a.playerId,
          note: a.note,
        },
      ],
    }),
  },

  "decision/open": {
    phases: ["turn"],
    actor: "system",
    // playerId === 'system' is enforced by the actor rule (step 5 → WRONG_ACTOR), not the guard.
    guard: (raw): raw is ActionOf<"decision/open"> =>
      hasBase(raw, "decision/open") &&
      hasExactKeys(raw, ["required", "defaultChoice"]) &&
      isStringArray(raw.required) &&
      isChoice(raw.defaultChoice),
    validate: (s, a) => {
      const { required } = a;
      if (required.length === 0) return reject("INVALID_PAYLOAD", "required must be non-empty");
      if (!isUnique(required)) {
        return reject("INVALID_PAYLOAD", "required must not contain duplicates");
      }
      const players: readonly PlayerId[] = Array.isArray(s.public.players) ? s.public.players : [];
      if (!required.every((p) => players.includes(p))) {
        return reject("INVALID_PAYLOAD", "required must only contain players");
      }
      return null;
    },
    apply: (s, a) => {
      const decisionSeq = s.hidden.decisionSeq + 1;
      const id = `d${decisionSeq}`;
      const required = [...a.required];
      return {
        state: {
          ...s,
          public: {
            ...s.public,
            phase: "decision",
            pending: { id, kind: "sample", required, committed: [] },
          },
          hidden: {
            ...s.hidden,
            decisionSeq,
            decision: { id, defaultChoice: a.defaultChoice, choices: {} },
          },
        },
        events: [{ v: 1, type: "DecisionOpened", visibility: PUBLIC, decisionId: id, required }],
      };
    },
  },

  "decision/commit": {
    phases: ["decision"],
    actor: "required",
    guard: (raw): raw is ActionOf<"decision/commit"> =>
      hasBase(raw, "decision/commit") &&
      hasExactKeys(raw, ["decisionId", "choice"]) &&
      typeof raw.decisionId === "string" &&
      isChoice(raw.choice),
    validate: (s, a) =>
      staleDecision(s, a.decisionId) ??
      (openDecision(s)?.pending.committed.includes(a.playerId)
        ? reject("ALREADY_COMMITTED", `${clip(a.playerId)} already committed`)
        : null),
    apply: (s, a) => {
      const { pending, decision } = requireOpenDecision(s);
      const committed = [...pending.committed, a.playerId];
      const choices = { ...decision.choices, [a.playerId]: a.choice };
      const events: GameEvent[] = [
        {
          v: 1,
          type: "ChoiceCommitted",
          visibility: PUBLIC,
          decisionId: pending.id,
          playerId: a.playerId,
        },
      ];
      if (pending.required.every((p) => committed.includes(p))) {
        const revealed = reveal(
          s,
          pending.id,
          orderedChoices(pending.required, choices, decision.defaultChoice),
          [],
        );
        return { state: revealed.state, events: [...events, revealed.event] };
      }
      return {
        state: {
          ...s,
          public: { ...s.public, pending: { ...pending, committed } },
          hidden: { ...s.hidden, decision: { ...decision, choices } },
        },
        events,
      };
    },
  },

  timeout: {
    phases: ["decision"],
    actor: "system",
    // playerId === 'system' is enforced by the actor rule (step 5 → WRONG_ACTOR), not the guard.
    guard: (raw): raw is ActionOf<"timeout"> =>
      hasBase(raw, "timeout") &&
      hasExactKeys(raw, ["decisionId"]) &&
      typeof raw.decisionId === "string",
    validate: (s, a) => staleDecision(s, a.decisionId),
    apply: (s) => {
      const { pending, decision } = requireOpenDecision(s);
      const timedOut = pending.required.filter((p) => !pending.committed.includes(p));
      const events: GameEvent[] = timedOut.map((playerId) => ({
        v: 1,
        type: "ChoiceTimedOut",
        visibility: PUBLIC,
        decisionId: pending.id,
        playerId,
      }));
      const revealed = reveal(
        s,
        pending.id,
        orderedChoices(pending.required, decision.choices, decision.defaultChoice),
        timedOut,
      );
      return { state: revealed.state, events: [...events, revealed.event] };
    },
  },
} satisfies { [K in Action["type"]]: Handler<ActionOf<K>> };
