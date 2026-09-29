import { createAi, decideCombat, type AiState, type Difficulty } from "@usurpia/core/ai";
import {
  createGame,
  hashState,
  reduce,
  viewFor,
  type Action,
  type ContentId,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Rules,
} from "@usurpia/core";
import { KITS, seatClass, TIER_LEVEL, tierForLevel } from "./kits";

/** A bad class/monster/matchup name from the caller; the CLI maps it to `usage:` + exit 2. */
export class UsageError extends Error {}

export interface DuelSpec {
  seed: string;
  a: { classId: ContentId; difficulty: Difficulty };
  b:
    | { kind: "class"; classId: ContentId; difficulty: Difficulty }
    | { kind: "monster"; monsterId: ContentId };
  level: number;
}

export interface DuelResult {
  outcome: "ko" | "fled" | "draw";
  winner: 0 | 1 | null;
  fled: 0 | 1 | null;
  /** Total events of every `reduce` call of the duel. */
  events: number;
  /** `hashState` of the final state. */
  hash: string;
}

const BAG: readonly ContentId[] = ["herb", "herb"];
/** A duel is at most 3 rounds x 2 exchanges; anything near this is a loop bug. */
const MAX_ITERATIONS = 100;

function setCharacter(target: PlayerId, classId: ContentId, level: number): Action {
  const kit = KITS[classId]?.[tierForLevel(level) - 1];
  if (kit === undefined) throw new UsageError(`no kit for class ${classId}`);
  return {
    v: 2,
    type: "system/setCharacter",
    playerId: "system",
    target,
    classId,
    level,
    weapon: kit.weapon,
    shield: kit.shield,
    accessory: kit.accessory,
    battleSpell: kit.battleSpell,
    wardSpell: kit.wardSpell,
    bag: [...BAG],
  };
}

function monsterTier(rules: Rules, monsterId: ContentId): number {
  const monster = Object.hasOwn(rules.monsters, monsterId) ? rules.monsters[monsterId] : undefined;
  if (monster === undefined) throw new UsageError(`unknown monster ${monsterId}`);
  return monster.tier;
}

/** Runs one CPU-vs-CPU (or CPU-vs-monster) combat through `reduce` and reports how it ended. */
export function runDuel(rules: Rules, spec: DuelSpec): DuelResult {
  const { a, b } = spec;
  const players = [{ id: "a", classId: seatClass(rules, a.classId) }];
  if (b.kind === "class") players.push({ id: "b", classId: seatClass(rules, b.classId) });
  let state: GameState = createGame({ v: 2, seed: spec.seed, players }, rules);

  let eventCount = 0;
  let ended: Extract<GameEvent, { type: "CombatEnded" }> | null = null;
  const apply = (action: Action): void => {
    const result = reduce(state, action, rules);
    if (!result.ok) {
      throw new Error(`duel action rejected: ${result.error.code} ${result.error.message}`);
    }
    state = result.state;
    eventCount += result.events.length;
    for (const event of result.events) if (event.type === "CombatEnded") ended = event;
  };

  const level = b.kind === "class" ? spec.level : TIER_LEVEL[monsterTier(rules, b.monsterId) - 1];
  if (level === undefined) throw new Error("monster tier has no level");
  apply(setCharacter("a", a.classId, level));
  if (b.kind === "class") apply(setCharacter("b", b.classId, level));
  apply({
    v: 2,
    type: "combat/start",
    playerId: "system",
    attacker: "a",
    opponent:
      b.kind === "class"
        ? { kind: "player", playerId: "b" }
        : { kind: "npc", npc: { kind: "monster", id: b.monsterId, senior: false } },
  });

  const ai: Record<string, AiState> = {
    a: createAi(spec.seed, "a", a.difficulty),
    b: createAi(spec.seed, "b", b.kind === "class" ? b.difficulty : "normal"),
  };
  let iterations = 0;
  while (state.public.phase === "decision") {
    if (++iterations > MAX_ITERATIONS) throw new Error("duel did not terminate");
    const pending = state.public.pending;
    if (pending === null) throw new Error("decision phase without a pending decision");
    for (const playerId of pending.required) {
      // Stop when the decision changed or closed (the phase leaving "decision" clears `pending`).
      const now = state.public.pending;
      if (now?.id !== pending.id) break;
      if (now.committed.includes(playerId)) continue;
      const current = ai[playerId];
      if (current === undefined) throw new Error(`no AI for ${playerId}`);
      const decision = decideCombat(viewFor(state, playerId), rules, current);
      if (decision.action === null) throw new Error(`AI ${playerId} produced no action`);
      ai[playerId] = decision.ai;
      apply(decision.action);
    }
  }

  const end = ended as Extract<GameEvent, { type: "CombatEnded" }> | null;
  if (end === null) throw new Error("duel finished without CombatEnded");
  return {
    outcome: end.outcome,
    winner: end.winner,
    fled: end.fled,
    events: eventCount,
    hash: hashState(state),
  };
}

export interface Matchup {
  readonly a: ContentId;
  readonly b: { kind: "class"; classId: ContentId } | { kind: "monster"; monsterId: ContentId };
  readonly group: "class-vs-class" | "class-vs-monster";
}

const MONSTER_PREFIX = "monster/";

function sortedKeys(record: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(record).sort();
}

/**
 * `classes | mirrors | monsters | all | <A>:<B> | <A>:monster/<id>`, ids ascending. Throws
 * {@link UsageError} for an unknown class or monster or a malformed spec.
 */
export function buildMatchups(rules: Rules, matchup: string): Matchup[] {
  const classes = sortedKeys(rules.classes);
  const monsters = sortedKeys(rules.monsters);
  const classVsClass = (a: ContentId, b: ContentId): Matchup => ({
    a,
    b: { kind: "class", classId: b },
    group: "class-vs-class",
  });
  const classVsMonster = (a: ContentId, monsterId: ContentId): Matchup => ({
    a,
    b: { kind: "monster", monsterId },
    group: "class-vs-monster",
  });
  const allClasses = classes.flatMap((a) => classes.map((b) => classVsClass(a, b)));
  const allMonsters = classes.flatMap((a) => monsters.map((m) => classVsMonster(a, m)));
  switch (matchup) {
    case "classes":
      return allClasses;
    case "mirrors":
      return classes.map((c) => classVsClass(c, c));
    case "monsters":
      return allMonsters;
    case "all":
      return [...allClasses, ...allMonsters];
  }
  const parts = matchup.split(":");
  const [a, b] = parts;
  if (parts.length !== 2 || a === undefined || b === undefined) {
    throw new UsageError(`unknown matchup "${matchup}"`);
  }
  if (!Object.hasOwn(rules.classes, a)) throw new UsageError(`unknown class "${a}"`);
  if (b.startsWith(MONSTER_PREFIX)) {
    const id = b.slice(MONSTER_PREFIX.length);
    if (!Object.hasOwn(rules.monsters, id)) throw new UsageError(`unknown monster "${id}"`);
    return [classVsMonster(a, id)];
  }
  if (!Object.hasOwn(rules.classes, b)) throw new UsageError(`unknown class "${b}"`);
  return [classVsClass(a, b)];
}
