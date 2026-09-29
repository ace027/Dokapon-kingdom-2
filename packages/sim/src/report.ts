import { rulesHash, stableStringify, type Rules } from "@usurpia/core";
import type { Difficulty } from "@usurpia/core/ai";
import { buildMatchups, runDuel } from "./duel";

export interface ReportOptions {
  n: number;
  matchup: string;
  difficulty: readonly [Difficulty, Difficulty];
  seed: string;
  level: number;
}

interface Tally {
  n: number;
  aWins: number;
  bWins: number;
  draws: number;
  fled: number;
}

/**
 * Runs `n` duels; duel `i` uses matchup `M[i mod |M|]`, seed `<seed>/<i>`, side A `dA`, side B `dB`.
 * `text` is the deterministic report and `json` its one-line `stableStringify` form (matchups
 * that ran no duel are omitted from both). Timing is the CLI's business (stderr only).
 */
export function runReport(rules: Rules, opts: ReportOptions): { text: string; json: string } {
  const { n, seed, level } = opts;
  const [dA, dB] = opts.difficulty;
  const matchups = buildMatchups(rules, opts.matchup);
  const tallies: Tally[] = matchups.map(() => ({ n: 0, aWins: 0, bWins: 0, draws: 0, fled: 0 }));

  for (let i = 0; i < n; i++) {
    const index = i % matchups.length;
    const m = matchups[index];
    const tally = tallies[index];
    if (m === undefined || tally === undefined) throw new Error("matchup index out of range");
    const result = runDuel(rules, {
      seed: `${seed}/${String(i)}`,
      a: { classId: m.a, difficulty: dA },
      b:
        m.b.kind === "class"
          ? { kind: "class", classId: m.b.classId, difficulty: dB }
          : { kind: "monster", monsterId: m.b.monsterId },
      level,
    });
    tally.n += 1;
    if (result.outcome === "ko") {
      if (result.winner === 0) tally.aWins += 1;
      else tally.bWins += 1;
    } else if (result.outcome === "draw") {
      tally.draws += 1;
    } else {
      tally.fled += 1;
    }
  }

  const hash = rulesHash(rules);
  const lines = [
    `duel n=${String(n)} seed=${seed} level=${String(level)} difficulty=${dA}:${dB} rules=${hash}`,
  ];
  const total = { aWins: 0, bWins: 0, draws: 0, fled: 0 };
  const jsonMatchups: Record<string, string | number>[] = [];
  let group = "";
  matchups.forEach((m, index) => {
    const t = tallies[index];
    if (t === undefined || t.n === 0) return;
    if (m.group !== group) {
      group = m.group;
      lines.push(`# ${group}`);
    }
    const bName = m.b.kind === "class" ? m.b.classId : `monster/${m.b.monsterId}`;
    const decisive = t.aWins + t.bWins;
    const rate = decisive > 0 ? (t.aWins / decisive).toFixed(3) : "n/a";
    lines.push(
      `${m.a}:${bName} n=${String(t.n)} a=${String(t.aWins)} b=${String(t.bWins)} draw=${String(t.draws)} fled=${String(t.fled)} aRate=${rate}`,
    );
    jsonMatchups.push({
      a: m.a,
      b: bName,
      n: t.n,
      aWins: t.aWins,
      bWins: t.bWins,
      draws: t.draws,
      fled: t.fled,
    });
    total.aWins += t.aWins;
    total.bWins += t.bWins;
    total.draws += t.draws;
    total.fled += t.fled;
  });
  lines.push(
    `total n=${String(n)} a=${String(total.aWins)} b=${String(total.bWins)} draw=${String(total.draws)} fled=${String(total.fled)}`,
  );
  const json = stableStringify({
    n,
    seed,
    level,
    difficulty: [dA, dB],
    rulesHash: hash,
    matchups: jsonMatchups,
  });
  return { text: lines.join("\n"), json };
}
