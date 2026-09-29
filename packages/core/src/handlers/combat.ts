// The combat state machine: `combat/start`, rounds, exchanges (commit/reveal through the generic
// decision module), NPC command draws inside `reduce`, round-end poison/regen and the endings.
// Every draw goes through `ctx.int` in the pinned order (spec: RNG draw order). Records keyed by a
// player id are read with `ownGet` (PIT-002).
import type { ActionOf, Ctx, Handler, Resolver } from "./shared";
import { hasExactKeys, isInt, overflow, ownGet, reject } from "./shared";
import { openDecision, type PromptSpec } from "./decision";
import { attackerOptions, DEFENDER_OPTIONS, exchangeRoles } from "../combat/options";
import {
  drawNpcCommand,
  drawNpcDefense,
  resolveExchange,
  snapshotNpc,
  snapshotPlayer,
  ZERO_MODS,
  type Combatant,
  type Draw,
  type DefenseCell,
  type Fighter,
  type FighterAfter,
} from "../combat/resolve";
import { npcDef, npcStats } from "../combat/stats";
import { awardVictory, progressionEvent, victoryReward } from "../progression";
import { onlyPlayers, PUBLIC, type GameEvent } from "../events";
import type { Opponent } from "../actions";
import { DEFEND_COMMANDS, type AttackCommand, type DefendCommand, type Rules } from "../rules";
import {
  MAX_STAT,
  type BattleMods,
  type CombatSide,
  type CombatState,
  type GameState,
  type NpcRef,
  type PlayerId,
} from "../types";
import { clip, isPlainObject } from "../validation";

type StartAction = ActionOf<"combat/start">;

const BP = 10_000;
const MAX_NPC_LEVEL = 99;

/** Combat state that the flow functions require; a missing one is an engine bug, not bad input. */
function activeCombat(state: GameState): CombatState {
  const { combat } = state.public;
  if (combat === null) throw new Error("invariant: no active combat");
  return combat;
}

/** `ctx.int` as a standalone function (the interface declares it as a method). */
function drawOf(ctx: Ctx): Draw {
  return (min, max) => ctx.int(min, max);
}

function isTownTier(value: unknown): value is 1 | 2 | 3 | 4 {
  return isInt(value, 1, 4);
}

function isNpcRef(value: unknown): value is NpcRef {
  if (!isPlainObject(value)) return false;
  switch (value.kind) {
    case "monster":
      return (
        hasExactKeys(value, ["kind", "id", "senior"]) &&
        typeof value.id === "string" &&
        typeof value.senior === "boolean"
      );
    case "guardian":
      return (
        hasExactKeys(value, ["kind", "id", "townTier"]) &&
        typeof value.id === "string" &&
        isTownTier(value.townTier)
      );
    case "enforcer":
      return hasExactKeys(value, ["kind", "level"]) && isInt(value.level, 1, MAX_NPC_LEVEL);
    default:
      return false;
  }
}

function isOpponent(value: unknown): value is Opponent {
  if (!isPlainObject(value)) return false;
  if (value.kind === "player") {
    return hasExactKeys(value, ["kind", "playerId"]) && typeof value.playerId === "string";
  }
  return value.kind === "npc" && hasExactKeys(value, ["kind", "npc"]) && isNpcRef(value.npc);
}

function isStartAction(raw: Record<string, unknown>): raw is StartAction {
  return (
    hasExactKeys(raw, ["v", "type", "playerId", "attacker", "opponent"]) &&
    raw.v === 2 &&
    raw.type === "combat/start" &&
    typeof raw.playerId === "string" &&
    typeof raw.attacker === "string" &&
    isOpponent(raw.opponent)
  );
}

function isKnockedOut(state: GameState, id: PlayerId): boolean {
  return ownGet(state.public.characters, id)?.hp === 0;
}

function seated(state: GameState, id: PlayerId): boolean {
  return state.public.players.includes(id);
}

/** State-dependent `combat/start` checks, in the spec's table order. */
function validateStart(state: GameState, a: StartAction, rules: Rules) {
  if (!seated(state, a.attacker))
    return reject("INVALID_PAYLOAD", "attacker must be a seated player");
  if (isKnockedOut(state, a.attacker)) return reject("INVALID_PAYLOAD", "attacker is knocked out");
  const { opponent } = a;
  if (opponent.kind === "player") {
    if (!seated(state, opponent.playerId)) {
      return reject("INVALID_PAYLOAD", "opponent player must be seated");
    }
    if (opponent.playerId === a.attacker) {
      return reject("INVALID_PAYLOAD", "opponent must differ from attacker");
    }
    if (isKnockedOut(state, opponent.playerId)) {
      return reject("INVALID_PAYLOAD", "opponent is knocked out");
    }
  } else {
    const { npc } = opponent;
    if (npc.kind === "monster" && ownGet(rules.monsters, npc.id) === undefined) {
      return reject("INVALID_PAYLOAD", "unknown monster");
    }
    if (npc.kind === "guardian" && ownGet(rules.guardians, npc.id) === undefined) {
      return reject("INVALID_PAYLOAD", "unknown guardian");
    }
    if (npc.kind === "enforcer" && npc.level > rules.progression.maxLevel) {
      return reject("INVALID_PAYLOAD", "enforcer level above maxLevel");
    }
  }
  if (overflow(state.hidden.combatSeq, 1)) {
    return reject("INVALID_PAYLOAD", "combatSeq would exceed MAX_COUNTER");
  }
  if (overflow(state.hidden.decisionSeq, 2 * rules.combat.maxRounds)) {
    return reject("INVALID_PAYLOAD", "decisionSeq would exceed MAX_COUNTER");
  }
  return null;
}

function requireCharacter(state: GameState, id: PlayerId) {
  const character = ownGet(state.public.characters, id);
  const priv = ownGet(state.private, id);
  if (character === undefined || priv === undefined) {
    throw new Error(`invariant: no character for ${clip(id)}`);
  }
  return { character, priv };
}

function fighterFor(state: GameState, rules: Rules, side: CombatSide): Fighter {
  if (side.kind === "npc") {
    return { isPlayer: false, snap: snapshotNpc(rules, side), mods: side.mods, gold: 0, bag: [] };
  }
  const { character, priv } = requireCharacter(state, side.playerId);
  return {
    isPlayer: true,
    snap: snapshotPlayer(rules, character, side.mods),
    mods: side.mods,
    gold: character.gold,
    bag: priv.bag,
  };
}

function snapshotOf(state: GameState, rules: Rules, side: CombatSide): Combatant {
  return fighterFor(state, rules, side).snap;
}

function hpOf(state: GameState, side: CombatSide): number {
  return side.kind === "npc" ? side.hp : requireCharacter(state, side.playerId).character.hp;
}

function hpPair(state: GameState): readonly [number, number] {
  const { sides } = activeCombat(state);
  return [hpOf(state, sides[0]), hpOf(state, sides[1])];
}

function withCombat(state: GameState, patch: Partial<CombatState>): GameState {
  return {
    ...state,
    public: { ...state.public, combat: { ...activeCombat(state), ...patch } },
  };
}

function withSide(state: GameState, index: 0 | 1, side: CombatSide): GameState {
  const { sides } = activeCombat(state);
  const next: [CombatSide, CombatSide] = index === 0 ? [side, sides[1]] : [sides[0], side];
  return withCombat(state, { sides: next });
}

function withMods(state: GameState, index: 0 | 1, mods: BattleMods): GameState {
  return withSide(state, index, { ...activeCombat(state).sides[index], mods });
}

function withHp(state: GameState, index: 0 | 1, hp: number): GameState {
  const side = activeCombat(state).sides[index];
  if (side.kind === "npc") return withSide(state, index, { ...side, hp });
  const { character } = requireCharacter(state, side.playerId);
  return {
    ...state,
    public: {
      ...state.public,
      characters: { ...state.public.characters, [side.playerId]: { ...character, hp } },
    },
  };
}

/** Writes an exchange outcome for one side back: hp, gold, bag (players), mods (all). */
function writeBack(state: GameState, index: 0 | 1, after: FighterAfter): GameState {
  const side = activeCombat(state).sides[index];
  if (side.kind === "npc")
    return withSide(state, index, { ...side, hp: after.hp, mods: after.mods });
  const { character, priv } = requireCharacter(state, side.playerId);
  const written: GameState = {
    ...state,
    public: {
      ...state.public,
      characters: {
        ...state.public.characters,
        [side.playerId]: { ...character, hp: after.hp, gold: after.gold },
      },
    },
    private: { ...state.private, [side.playerId]: { ...priv, bag: [...after.bag] } },
  };
  return withSide(written, index, { ...side, mods: after.mods });
}

function sameBag(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function bagEvent(playerId: PlayerId, bag: readonly string[]): GameEvent {
  return { v: 2, type: "BagUpdated", visibility: onlyPlayers([playerId]), playerId, bag: [...bag] };
}

/**
 * Ends the combat: emits `CombatEnded` (hp read while the sides still exist) and clears `combat`.
 * The phase is already `turn` after the reveal, and pending/prompts are already cleared.
 * Players keep their hp (a KO leaves hp 0); battle mods vanish with the combat state.
 */
export function endCombat(
  state: GameState,
  outcome: "ko" | "fled" | "draw",
  winner: 0 | 1 | null,
  fled: 0 | 1 | null,
  rules: Rules,
  events: GameEvent[],
): GameState {
  const combat = activeCombat(state);
  events.push({
    v: 2,
    type: "CombatEnded",
    visibility: PUBLIC,
    combatId: combat.id,
    outcome,
    winner,
    fled,
    hp: hpPair(state),
  });
  const closed: GameState = { ...state, public: { ...state.public, combat: null } };
  if (outcome !== "ko" || winner === null) return closed;
  return rewardWinner(closed, combat.sides, winner, rules, events);
}

/** Appends the victory events after `CombatEnded` when the KO winner is a player (NPC wins pay nothing). */
function rewardWinner(
  state: GameState,
  sides: CombatState["sides"],
  winner: 0 | 1,
  rules: Rules,
  events: GameEvent[],
): GameState {
  const winning = sides[winner];
  const loser = sides[winner === 0 ? 1 : 0];
  if (winning.kind !== "player") return state;
  const character = ownGet(state.public.characters, winning.playerId);
  if (character === undefined) return state;
  const loserLevel =
    loser.kind === "player" ? (ownGet(state.public.characters, loser.playerId)?.level ?? 0) : 0;
  const award = awardVictory(rules, character, victoryReward(rules, loser, loserLevel));
  for (const event of award.events) events.push(progressionEvent(winning.playerId, event));
  return {
    ...state,
    public: {
      ...state.public,
      characters: { ...state.public.characters, [winning.playerId]: award.character },
    },
  };
}

/** Higher battle SPD goes first; a tie is broken by a LUCK-weighted draw. */
function initiative(state: GameState, ctx: Ctx, rules: Rules): 0 | 1 {
  const { sides } = activeCombat(state);
  const a = snapshotOf(state, rules, sides[0]).stats;
  const b = snapshotOf(state, rules, sides[1]).stats;
  if (a.spd !== b.spd) return a.spd > b.spd ? 0 : 1;
  const u = ctx.int(1, a.luck + b.luck + 2);
  return u <= a.luck + 1 ? 0 : 1;
}

function startRound(
  state: GameState,
  round: number,
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
): GameState {
  const first = initiative(state, ctx, rules);
  const next = withCombat(state, { round, exchange: 1, first });
  events.push({
    v: 2,
    type: "RoundStarted",
    visibility: PUBLIC,
    combatId: activeCombat(next).id,
    round,
    first,
  });
  return next;
}

/** Round-end poison then regen for both (standing) sides; returns the actual amounts. */
function roundEnd(state: GameState, rules: Rules, events: GameEvent[]): GameState {
  const combat = activeCombat(state);
  const poison: [number, number] = [0, 0];
  const regen: [number, number] = [0, 0];
  let next = state;
  for (const index of [0, 1] as const) {
    const side = combat.sides[index];
    const snap = snapshotOf(next, rules, side);
    let hp = snap.hp;
    if (hp === 0) continue;
    if (side.mods.poison) {
      const p = Math.max(1, Math.floor((snap.maxHp * rules.combat.poisonBp) / BP));
      const lowered = Math.max(1, hp - p);
      poison[index] = hp - lowered;
      hp = lowered;
    }
    if (snap.hooks.roundRegenBp > 0) {
      const gain = Math.min(
        snap.maxHp - hp,
        Math.floor((snap.maxHp * snap.hooks.roundRegenBp) / BP),
      );
      regen[index] = gain;
      hp += gain;
    }
    next = withHp(next, index, hp);
  }
  events.push({
    v: 2,
    type: "RoundEnded",
    visibility: PUBLIC,
    combatId: combat.id,
    round: combat.round,
    poison,
    regen,
    hp: hpPair(next),
  });
  return next;
}

/**
 * Moves on after an exchange: exchange 1 -> 2; after exchange 2 the round ends and either the
 * combat is drawn (`maxRounds` reached) or the next round starts. Returns a state whose `combat`
 * is `null` when the combat ended.
 */
function advance(state: GameState, ctx: Ctx, rules: Rules, events: GameEvent[]): GameState {
  const combat = activeCombat(state);
  if (combat.exchange === 1) return withCombat(state, { exchange: 2 });
  const ended = roundEnd(state, rules, events);
  if (combat.round >= rules.combat.maxRounds) {
    return endCombat(ended, "draw", null, null, rules, events);
  }
  return startRound(ended, combat.round + 1, ctx, rules, events);
}

function isAttackCommand(command: string): command is AttackCommand {
  return command === "attack" || command === "strike" || command === "spell";
}

function asDefense(choice: string | undefined): DefendCommand {
  return DEFEND_COMMANDS.find((command) => command === choice) ?? "guard";
}

/** The attacker's command: the revealed choice, or a weighted draw from the NPC's table. */
function attackerCommand(
  state: GameState,
  side: CombatSide,
  choices: Readonly<Record<PlayerId, string>>,
  ctx: Ctx,
  rules: Rules,
): string {
  if (side.kind === "player") return ownGet(choices, side.playerId) ?? "attack";
  const def = npcDef(rules, side.npc);
  // An NPC without a battle spell never draws "spell": its weight is left out of the table.
  const table = def.battleSpell === null ? { ...def.attackTable, spell: 0 } : def.attackTable;
  return drawNpcCommand(table, drawOf(ctx));
}

/** Resolves the current exchange (spec steps 1-7); returns `combat: null` when it ended. */
function resolveCurrent(
  state: GameState,
  choices: Readonly<Record<PlayerId, string>>,
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
): GameState {
  const combat = activeCombat(state);
  const { attacker: ai, defender: di } = exchangeRoles(combat);
  const aSide = combat.sides[ai];
  const dSide = combat.sides[di];
  const command = attackerCommand(state, aSide, choices, ctx, rules);
  const attacks = isAttackCommand(command);
  let defense: DefenseCell | null = null;
  let next = state;
  if (dSide.mods.stun) {
    next = withMods(next, di, { ...dSide.mods, stun: false });
    defense = attacks ? "open" : null;
  } else if (attacks) {
    defense =
      dSide.kind === "player"
        ? asDefense(ownGet(choices, dSide.playerId))
        : drawNpcDefense(npcDef(rules, dSide.npc).defendTable, drawOf(ctx));
  }
  const sides = activeCombat(next).sides;
  const outcome = resolveExchange(
    rules,
    {
      attacker: fighterFor(next, rules, sides[ai]),
      defender: fighterFor(next, rules, sides[di]),
      command,
      defense,
    },
    drawOf(ctx),
  );
  const aBefore = fighterFor(next, rules, sides[ai]).bag;
  const dBefore = fighterFor(next, rules, sides[di]).bag;
  next = writeBack(next, ai, outcome.attacker);
  next = writeBack(next, di, outcome.defender);
  const bySide = <T>(attacker: T, defender: T): readonly [T, T] =>
    ai === 0 ? [attacker, defender] : [defender, attacker];
  events.push({
    v: 2,
    type: "ExchangeResolved",
    visibility: PUBLIC,
    combatId: combat.id,
    round: combat.round,
    exchange: combat.exchange,
    attacker: ai,
    command,
    defense,
    crit: outcome.crit,
    damage: bySide(outcome.damage.attacker, outcome.damage.defender),
    heal: bySide(outcome.heal.attacker, outcome.heal.defender),
    effects: [...outcome.effects],
    hp: hpPair(next),
  });
  if (aSide.kind === "player" && !sameBag(aBefore, outcome.attacker.bag)) {
    events.push(bagEvent(aSide.playerId, outcome.attacker.bag));
  }
  if (dSide.kind === "player" && !sameBag(dBefore, outcome.defender.bag)) {
    events.push(bagEvent(dSide.playerId, outcome.defender.bag));
  }
  if (outcome.fled) return endCombat(next, "fled", null, ai, rules, events);
  const [hp0, hp1] = hpPair(next);
  if (hp0 === 0 && hp1 === 0) return endCombat(next, "draw", null, null, rules, events);
  if (hp0 === 0 || hp1 === 0) return endCombat(next, "ko", hp0 === 0 ? 1 : 0, null, rules, events);
  return advance(next, ctx, rules, events);
}

/** Prompts of the current exchange, attacker first (empty when no player has to choose). */
function exchangePrompts(state: GameState, rules: Rules): PromptSpec[] {
  const combat = activeCombat(state);
  const { attacker, defender } = exchangeRoles(combat);
  const a = combat.sides[attacker];
  const d = combat.sides[defender];
  const prompts: PromptSpec[] = [];
  if (a.kind === "player") {
    const { character, priv } = requireCharacter(state, a.playerId);
    prompts.push({
      playerId: a.playerId,
      options: attackerOptions(rules, character, priv.bag),
      default: "attack",
    });
  }
  if (d.kind === "player" && !d.mods.stun) {
    prompts.push({ playerId: d.playerId, options: DEFENDER_OPTIONS, default: "guard" });
  }
  return prompts;
}

/**
 * Advances the combat until a player has to choose (opens the `combat/exchange` decision) or the
 * combat ends. A stunned attacker skips its exchange; exchanges with no player choosing resolve
 * immediately. Precondition: `combat` is non-null.
 */
export function openExchange(
  state: GameState,
  ctx: Ctx,
  rules: Rules,
  events: GameEvent[],
): GameState {
  let current = state;
  for (;;) {
    const combat = current.public.combat;
    if (combat === null) return current;
    const { attacker } = exchangeRoles(combat);
    const aSide = combat.sides[attacker];
    if (aSide.mods.stun) {
      const cleared = withMods(current, attacker, { ...aSide.mods, stun: false });
      events.push({
        v: 2,
        type: "ExchangeSkipped",
        visibility: PUBLIC,
        combatId: combat.id,
        round: combat.round,
        exchange: combat.exchange,
        attacker,
        reason: "stunned",
      });
      current = advance(cleared, ctx, rules, events);
      continue;
    }
    const prompts = exchangePrompts(current, rules);
    if (prompts.length > 0) return openDecision(current, "combat/exchange", prompts, events);
    current = resolveCurrent(current, {}, ctx, rules, events);
  }
}

/** The `combat/exchange` resolver: resolves the revealed exchange, then opens the next one. */
export const resolveCombatExchange: Resolver = (state, choices, ctx, rules, events) => {
  const resolved = resolveCurrent(state, choices, ctx, rules, events);
  return resolved.public.combat === null ? resolved : openExchange(resolved, ctx, rules, events);
};

function npcSide(rules: Rules, npc: NpcRef): CombatSide {
  const stats = npcStats(rules, npc);
  return {
    kind: "npc",
    npc: { ...npc },
    stats,
    hp: Math.min(MAX_STAT, stats.hp),
    mods: { ...ZERO_MODS },
  };
}

export const combatStartHandler: Handler<StartAction> = {
  phases: ["turn"],
  actor: "system",
  guard: isStartAction,
  validate: validateStart,
  apply: (state, a, ctx, rules) => {
    const events: GameEvent[] = [];
    const combatSeq = state.hidden.combatSeq + 1;
    const opponentSide: CombatSide =
      a.opponent.kind === "player"
        ? { kind: "player", playerId: a.opponent.playerId, mods: { ...ZERO_MODS } }
        : npcSide(rules, a.opponent.npc);
    const sides: [CombatSide, CombatSide] = [
      { kind: "player", playerId: a.attacker, mods: { ...ZERO_MODS } },
      opponentSide,
    ];
    const combat: CombatState = { id: `c${combatSeq}`, round: 1, exchange: 1, first: 0, sides };
    events.push({ v: 2, type: "CombatStarted", visibility: PUBLIC, combatId: combat.id, sides });
    const started: GameState = {
      ...state,
      public: { ...state.public, combat },
      hidden: { ...state.hidden, combatSeq },
    };
    const round = startRound(started, 1, ctx, rules, events);
    return { state: openExchange(round, ctx, rules, events), events };
  },
};
