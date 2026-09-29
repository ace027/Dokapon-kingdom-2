// Step 5 of the AI algorithm: the distribution `q` over the opponent's possible commands. Reads
// only the PlayerView (public choice history) and Rules (class biases / public NPC tables).
import { snapshotNpc, snapshotPlayer, type Combatant } from "../combat/resolve";
import type { Command, Rules } from "../rules";
import type { CombatSide } from "../types";
import { ownGet } from "../validation";
import type { PlayerView } from "../views";
import { AI_TUNING } from "./tuning";

export type OpponentKey = Command | "open";

export interface OpponentModel {
  readonly okeys: readonly OpponentKey[];
  readonly q: readonly number[];
}

/** Battle snapshot of one combat side, built from public data only. */
export function snapshotSide(view: PlayerView, rules: Rules, side: CombatSide): Combatant {
  if (side.kind === "npc") return snapshotNpc(rules, side);
  const ch = ownGet(view.public.characters, side.playerId);
  if (ch === undefined) throw new Error(`ai: unknown character ${side.playerId}`);
  return snapshotPlayer(rules, ch, side.mods);
}

function normalise(weights: readonly number[]): number[] {
  const all = weights.every((w) => w === 0) ? weights.map(() => 1) : weights;
  const total = all.reduce((a, b) => a + b, 0);
  return all.map((w) => w / total);
}

function priorWeights(
  view: PlayerView,
  rules: Rules,
  side: CombatSide,
  okeys: readonly Command[],
  opponentDefends: boolean,
): number[] {
  if (side.kind === "player") {
    const ch = ownGet(view.public.characters, side.playerId);
    const cls = ch === undefined ? undefined : ownGet(rules.classes, ch.classId);
    if (cls === undefined) throw new Error(`ai: unknown class for ${side.playerId}`);
    return okeys.map((k) => cls.aiBias[k]);
  }
  const def =
    side.npc.kind === "monster"
      ? ownGet(rules.monsters, side.npc.id)
      : side.npc.kind === "guardian"
        ? ownGet(rules.guardians, side.npc.id)
        : rules.enforcer;
  if (def === undefined) throw new Error("ai: unknown npc");
  const table: Partial<Record<Command, number>> = opponentDefends
    ? def.defendTable
    : def.attackTable;
  return okeys.map((k) => table[k] ?? 0);
}

/**
 * The opponent's command distribution for the viewer at `meIndex`. A stunned defender can only be
 * `open`. Normal uses the opponent's prior; Hard sharpens a player opponent's prior with the public
 * per-player choice history (smoothed by `hardPriorStrength`), and keeps the prior for NPCs.
 */
export function opponentDistribution(
  view: PlayerView,
  rules: Rules,
  difficulty: "normal" | "hard",
  meIndex: 0 | 1,
): OpponentModel {
  const combat = view.public.combat;
  const prompt = view.self?.prompt ?? null;
  if (combat === null || prompt === null) {
    throw new Error("ai: opponentDistribution needs a combat prompt");
  }
  const iAttack = prompt.options.includes("attack");
  const opSide = combat.sides[meIndex === 0 ? 1 : 0];
  if (iAttack && opSide.mods.stun) return { okeys: ["open"], q: [1] };
  const op = snapshotSide(view, rules, opSide);
  const okeys: Command[] = iAttack
    ? ["guard", "counter", "ward"]
    : op.spell !== null
      ? ["attack", "strike", "spell"]
      : ["attack", "strike"];
  const pn = normalise(priorWeights(view, rules, opSide, okeys, iAttack));
  if (difficulty === "hard" && opSide.kind === "player") {
    const history = ownGet(view.public.choiceHistory, opSide.playerId);
    if (history !== undefined) {
      const n = okeys.map((k) => history[k]);
      const total = n.reduce((a, b) => a + b, 0);
      const alpha = AI_TUNING.hardPriorStrength;
      return { okeys, q: n.map((count, i) => (count + alpha * (pn[i] ?? 0)) / (total + alpha)) };
    }
  }
  return { okeys, q: pn };
}
