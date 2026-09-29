// Easy / Normal / Hard combat CPU (spec: CPU AI, algorithm steps 1-8). Reads a PlayerView and
// Rules only, draws from its own seeded RngState, and returns a `decision/commit` action.
// Only IEEE + - * / , comparisons and Math.floor/round/min/max are used (see exp.ts).
import type { Action } from "../actions";
import {
  computeCell,
  critChanceBp,
  isCritEligible,
  type Combatant,
  type DefenseCell,
} from "../combat/resolve";
import { nextInt, seedRng, type RngState } from "../rng";
import {
  ATTACK_COMMANDS,
  DEFEND_COMMANDS,
  type AttackCommand,
  type Command,
  type ContentId,
  type Rules,
} from "../rules";
import type { CombatSide, PlayerId, Prompt } from "../types";
import { ownGet } from "../validation";
import type { PlayerView } from "../views";
import { expNeg } from "./exp";
import { opponentDistribution, snapshotSide, type OpponentKey } from "./opponent-model";
import { AI_TUNING } from "./tuning";

export type Difficulty = "easy" | "normal" | "hard";

export interface AiState {
  readonly rng: RngState;
  readonly playerId: PlayerId;
  readonly difficulty: Difficulty;
}

export interface AiDecision {
  readonly action: Action | null;
  readonly ai: AiState;
}

export interface Policy {
  readonly commands: readonly Command[];
  readonly weights: readonly number[];
  readonly ev: readonly number[] | null;
}

const BP = 10_000;
const ITEM_PREFIX = "item:";
const MIN_BASE_WEIGHT = 1e-9;

/** `seed` is the game's `settings.seed` (the caller passes it). */
export function createAi(seed: string, playerId: PlayerId, difficulty: Difficulty): AiState {
  return {
    rng: seedRng(`${seed}\u0000ai\u0000${playerId}\u0000${difficulty}`),
    playerId,
    difficulty,
  };
}

interface Situation {
  readonly prompt: Prompt;
  readonly meIndex: 0 | 1;
  readonly me: Combatant;
  readonly op: Combatant;
  readonly role: "attacker" | "defender";
}

/** Step 1: which side is the viewer, and both battle snapshots. `null` without a combat prompt. */
function situationOf(view: PlayerView, rules: Rules): Situation | null {
  const prompt = view.self?.prompt ?? null;
  const combat = view.public.combat;
  if (prompt === null || combat === null) return null;
  const isMe = (side: CombatSide): boolean =>
    side.kind === "player" && side.playerId === view.viewer;
  const meIndex = isMe(combat.sides[0]) ? 0 : isMe(combat.sides[1]) ? 1 : null;
  if (meIndex === null) return null;
  const opIndex = meIndex === 0 ? 1 : 0;
  return {
    prompt,
    meIndex,
    me: snapshotSide(view, rules, combat.sides[meIndex]),
    op: snapshotSide(view, rules, combat.sides[opIndex]),
    role: prompt.options.includes("attack") ? "attacker" : "defender",
  };
}

function asAttack(key: OpponentKey): AttackCommand {
  if (key === "attack" || key === "strike" || key === "spell") return key;
  throw new Error(`ai: ${key} is not an attack command`);
}

function asDefense(key: OpponentKey): DefenseCell {
  if (key === "guard" || key === "counter" || key === "ward" || key === "open") return key;
  throw new Error(`ai: ${key} is not a defence`);
}

/** Step 6 `val(a, d)`: expected value of one (attack, defence) cell for the viewer. */
function cellValue(rules: Rules, s: Situation, a: AttackCommand, d: DefenseCell): number {
  const att = s.role === "attacker" ? s.me : s.op;
  const def = s.role === "attacker" ? s.op : s.me;
  const p = isCritEligible(a, d) ? critChanceBp(rules, att) / BP : 0;
  const r0 = computeCell(rules.combat, att, def, a, d, false);
  const r1 = p > 0 ? computeCell(rules.combat, att, def, a, d, true) : r0;
  const toDef = (1 - p) * r0.toDefender + p * r1.toDefender;
  const toAtt = (1 - p) * r0.toAttacker + p * r1.toAttacker;
  const healAtt = (1 - p) * r0.healAttacker + p * r1.healAttacker;
  const healDef = (1 - p) * r0.healDefender + p * r1.healDefender;
  const v =
    (Math.min(toDef, def.hp) - healDef) / def.maxHp -
    (Math.min(toAtt, att.hp) - healAtt) / att.maxHp +
    (toDef >= def.hp ? AI_TUNING.koBonus : 0) -
    (toAtt >= att.hp ? AI_TUNING.koBonus : 0);
  return s.role === "attacker" ? v : -v;
}

/**
 * Steps 3-7: the command weights a difficulty assigns to the viewer's current prompt (no RNG).
 * Throws when the viewer has no combat prompt.
 */
export function combatPolicy(view: PlayerView, rules: Rules, difficulty: Difficulty): Policy {
  const s = situationOf(view, rules);
  if (s === null) throw new Error("ai: combatPolicy needs a combat prompt for the viewer");
  const source: readonly Command[] = s.role === "attacker" ? ATTACK_COMMANDS : DEFEND_COMMANDS;
  const commands = source.filter((k) => s.prompt.options.includes(k));
  const me = ownGet(view.public.characters, view.viewer);
  const cls = me === undefined ? undefined : ownGet(rules.classes, me.classId);
  if (cls === undefined) throw new Error(`ai: unknown class for ${view.viewer}`);
  const bias = commands.map((k) => cls.aiBias[k]);
  const base = bias.every((w) => w === 0) ? bias.map(() => 1) : bias;
  if (difficulty === "easy") return { commands, weights: base, ev: null };

  const { okeys, q } = opponentDistribution(view, rules, difficulty, s.meIndex);
  const ev = commands.map((k) => {
    let total = 0;
    okeys.forEach((o, i) => {
      const value =
        s.role === "attacker"
          ? cellValue(rules, s, asAttack(k), asDefense(o))
          : cellValue(rules, s, asAttack(o), asDefense(k));
      total = total + (q[i] ?? 0) * value;
    });
    return total;
  });
  const temp = difficulty === "normal" ? AI_TUNING.normalTemp : AI_TUNING.hardTemp;
  const z = ev.map((x) => x / temp);
  const top = Math.max(...z);
  const e = z.map((zk, i) => {
    const prior = base[i] ?? 0;
    const factor = difficulty === "normal" ? (prior > 0 ? prior : MIN_BASE_WEIGHT) : 1;
    return factor * expNeg(zk - top);
  });
  const sum = e.reduce((a, b) => a + b, 0);
  const weights = e.map((x) => Math.round((x / sum) * AI_TUNING.weightScale));
  return { commands, weights, ev };
}

/** Step 8: `u = nextInt(1, sum)`; the first index whose running sum reaches `u`. */
function drawWeighted<T>(
  ai: AiState,
  keys: readonly T[],
  weights: readonly number[],
): { choice: T; ai: AiState } {
  const total = weights.reduce((a, b) => a + b, 0);
  const [u, rng] = nextInt(ai.rng, 1, total);
  let running = 0;
  for (const [i, key] of keys.entries()) {
    running += weights[i] ?? 0;
    if (running >= u) return { choice: key, ai: { ...ai, rng } };
  }
  throw new Error("ai: weighted draw fell outside the weights");
}

function commit(view: PlayerView, prompt: Prompt, choice: string, ai: AiState): AiDecision {
  return {
    action: {
      v: 2,
      type: "decision/commit",
      playerId: view.viewer,
      decisionId: prompt.decisionId,
      choice,
    },
    ai,
  };
}

/**
 * Step 2: the attacker's heal rule. The smallest heal that covers the missing hp, else the largest
 * heal (ties: the earlier option). Easy may forget it. `choice` is `null` when the rule does not fire.
 */
function healChoice(
  rules: Rules,
  s: Situation,
  ai: AiState,
): { choice: string | null; ai: AiState } {
  if (s.role !== "attacker" || s.me.hp * BP > s.me.maxHp * AI_TUNING.healThresholdBp) {
    return { choice: null, ai };
  }
  const heals = s.prompt.options.flatMap((option): { option: string; amount: number }[] => {
    if (!option.startsWith(ITEM_PREFIX)) return [];
    const id: ContentId = option.slice(ITEM_PREFIX.length);
    const effect = ownGet(rules.items, id)?.effect;
    return effect?.kind === "heal"
      ? [{ option, amount: Math.floor((s.me.maxHp * effect.bp) / BP) }]
      : [];
  });
  if (heals.length === 0) return { choice: null, ai };
  let next = ai;
  if (ai.difficulty === "easy") {
    const [u, rng] = nextInt(ai.rng, 1, BP);
    next = { ...ai, rng };
    if (u <= AI_TUNING.easyForgetHealBp) return { choice: null, ai: next };
  }
  const missing = s.me.maxHp - s.me.hp;
  const enough = heals.filter((h) => h.amount >= missing);
  const sufficient = enough.length > 0;
  let best = sufficient ? enough[0] : heals[0];
  for (const h of sufficient ? enough : heals) {
    if (best !== undefined && (sufficient ? h.amount < best.amount : h.amount > best.amount)) {
      best = h;
    }
  }
  return { choice: best?.option ?? null, ai: next };
}

/**
 * Pure: never mutates `view`, `rules` or `ai`. Returns `{action: null, ai}` (the same `ai`) unless
 * the viewer holds an uncommitted combat/exchange prompt for the open decision.
 */
export function decideCombat(view: PlayerView, rules: Rules, ai: AiState): AiDecision {
  const pending = view.public.pending;
  const prompt = view.self?.prompt ?? null;
  if (prompt === null) return { action: null, ai };
  if (pending === null) return { action: null, ai };
  if (pending.kind !== "combat/exchange") return { action: null, ai };
  if (pending.id !== prompt.decisionId) return { action: null, ai };
  if (pending.committed.includes(view.viewer)) return { action: null, ai };
  const s = situationOf(view, rules);
  if (s === null) return { action: null, ai };

  const heal = healChoice(rules, s, ai);
  if (heal.choice !== null) return commit(view, prompt, heal.choice, heal.ai);

  const policy = combatPolicy(view, rules, ai.difficulty);
  const picked = drawWeighted(heal.ai, policy.commands, policy.weights);
  return commit(view, prompt, picked.choice, picked.ai);
}
