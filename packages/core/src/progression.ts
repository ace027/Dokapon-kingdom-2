// Progression: XP/levels, class mastery ranks, hybrid unlocks and victory rewards. Pure, no
// GameState. Every award saturates at MAX_COUNTER; hp goes through `adjustHp`. Records keyed by
// content ids are read with `ownGet` (PIT-002).
import { adjustHp, sheetStats } from "./combat/stats";
import { PUBLIC, type GameEvent } from "./events";
import { levelForXp, masteryRank, type ContentId, type Rules } from "./rules";
import {
  MAX_COUNTER,
  SCHEMA_VERSION,
  type CharacterPublic,
  type CombatSide,
  type PlayerId,
} from "./types";
import { ownGet } from "./validation";

const BP = 10_000;

/** A progression event before the engine stamps the version, visibility and player onto it. */
export type ProgressionEvent =
  | { type: "VictoryRewarded"; xp: number; gold: number; classId: ContentId; masteryWins: number }
  | { type: "LevelUp"; level: number }
  | { type: "MasteryRankUp"; classId: ContentId; rank: number }
  | { type: "HybridUnlocked"; classId: ContentId };

/** Stamps a progression event for `playerId` (all four are public). */
export function progressionEvent(playerId: PlayerId, event: ProgressionEvent): GameEvent {
  return { v: SCHEMA_VERSION, visibility: PUBLIC, playerId, ...event };
}

function saturatingAdd(a: number, b: number): number {
  return Math.min(MAX_COUNTER, a + b);
}

/** Sorted ids of the hybrid classes whose parents both reached `hybridUnlockRank`. */
export function hybridsUnlocked(
  rules: Rules,
  mastery: Readonly<Record<ContentId, number>>,
): ContentId[] {
  const need = rules.progression.hybridUnlockRank;
  return Object.keys(rules.classes)
    .sort()
    .filter((id) => {
      const def = ownGet(rules.classes, id);
      if (def?.kind !== "hybrid" || def.parents === null) return false;
      return def.parents.every((p) => masteryRank(rules, ownGet(mastery, p) ?? 0) >= need);
    });
}

/** The same character with its hp carried over a sheet change (KO stays KO, gains carry). */
export function withAdjustedHp(
  rules: Rules,
  before: CharacterPublic,
  after: CharacterPublic,
): CharacterPublic {
  return {
    ...after,
    hp: adjustHp(sheetStats(rules, before).hp, sheetStats(rules, after).hp, before.hp),
  };
}

/** Adds saturating XP, recomputes the level and returns every level gained (ascending). */
export function applyXp(
  rules: Rules,
  ch: CharacterPublic,
  amount: number,
): { character: CharacterPublic; levelsGained: number[] } {
  const xp = saturatingAdd(ch.xp, amount);
  const level = levelForXp(rules, xp);
  const levelsGained: number[] = [];
  for (let next = ch.level + 1; next <= level; next += 1) levelsGained.push(next);
  return { character: withAdjustedHp(rules, ch, { ...ch, xp, level }), levelsGained };
}

/** The reward for beating `loser` (the reward only applies to a KO won by a player). */
export function victoryReward(
  rules: Rules,
  loser: CombatSide,
  loserLevel: number,
): { xp: number; gold: number } {
  const raw = rawReward(rules, loser, loserLevel);
  // Content values are schema-bounded, but the engine never pays a negative amount.
  return { xp: Math.max(0, raw.xp), gold: Math.max(0, raw.gold) };
}

function rawReward(
  rules: Rules,
  loser: CombatSide,
  loserLevel: number,
): { xp: number; gold: number } {
  if (loser.kind === "player") return { xp: rules.combat.pvpXpPerLevel * loserLevel, gold: 0 };
  const { npc } = loser;
  switch (npc.kind) {
    case "monster": {
      const def = ownGet(rules.monsters, npc.id);
      if (def === undefined) throw new Error(`unknown monster ${npc.id}`);
      const m = npc.senior ? rules.combat.seniorRewardBp : BP;
      return { xp: Math.floor((def.xp * m) / BP), gold: Math.floor((def.gold * m) / BP) };
    }
    case "guardian": {
      const def = ownGet(rules.guardians, npc.id);
      if (def === undefined) throw new Error(`unknown guardian ${npc.id}`);
      return { xp: def.xpPerTier * npc.townTier, gold: def.goldPerTier * npc.townTier };
    }
    case "enforcer":
      return {
        xp: rules.enforcer.xpPerLevel * npc.level,
        gold: rules.enforcer.goldPerLevel * npc.level,
      };
  }
}

/**
 * Applies a victory: xp, gold and one mastery win for the current class (all saturating), the new
 * level, and the events in spec order: `VictoryRewarded`, `LevelUp` per level, `MasteryRankUp`
 * when the rank rose, `HybridUnlocked` per newly unlocked hybrid (ascending).
 */
export function awardVictory(
  rules: Rules,
  ch: CharacterPublic,
  reward: { xp: number; gold: number },
): { character: CharacterPublic; events: ProgressionEvent[] } {
  const oldWins = ownGet(ch.mastery, ch.classId) ?? 0;
  const wins = saturatingAdd(oldWins, 1);
  const { character: leveled, levelsGained } = applyXp(rules, ch, reward.xp);
  const character = withAdjustedHp(rules, ch, {
    ...leveled,
    gold: saturatingAdd(ch.gold, reward.gold),
    mastery: { ...ch.mastery, [ch.classId]: wins },
  });
  const events: ProgressionEvent[] = [
    {
      type: "VictoryRewarded",
      xp: reward.xp,
      gold: reward.gold,
      classId: ch.classId,
      masteryWins: wins,
    },
  ];
  for (const level of levelsGained) events.push({ type: "LevelUp", level });
  const rank = masteryRank(rules, wins);
  if (rank > masteryRank(rules, oldWins)) {
    events.push({ type: "MasteryRankUp", classId: ch.classId, rank });
  }
  const before = hybridsUnlocked(rules, ch.mastery);
  for (const classId of hybridsUnlocked(rules, character.mastery)) {
    if (!before.includes(classId)) events.push({ type: "HybridUnlocked", classId });
  }
  return { character, events };
}
