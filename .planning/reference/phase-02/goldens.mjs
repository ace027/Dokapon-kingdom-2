// Single source of every golden pinned in .planning/specs/02-combat-core-balance-sim-spec.md.
// computeGoldens() returns { snippets: {name: markdownText}, traces: {file: jsonValue}, scenarios }.
// gen-goldens.mjs prints the snippets and writes traces/; verify-spec.mjs checks the spec against them.
import { createGame, reduce, viewFor, sheetStats, npcStats, computeCell, applyPassives, critChance, setRewardsEnabled } from "./engine.mjs";
import { hashState, rulesHash, stableStringify } from "./kernel.mjs";
import { TEST_RULES } from "./spec-test-rules.mjs";
import { RULES } from "./content-rules.mjs";
import { duel } from "./sim.mjs";
import { createAi, decideCombat, combatPolicy } from "./ai.mjs";

const J = (x) => JSON.stringify(x);
const st = (s) => `${s.hp}/${s.atk}/${s.def}/${s.mag}/${s.spd}/${s.luck}`;

// ---------------------------------------------------------------- scenarios (actions are the spec's JSON blocks)
const V = (a) => ({ v: 2, ...a });
export const SCENARIOS = {
  "kernel-game": {
    rules: "test",
    settings: { v: 2, seed: "fixture", players: [{ id: "p1", classId: "fighter" }, { id: "p2", classId: "caster" }] },
    actions: [
      V({ type: "decision/open", playerId: "system", prompts: [{ playerId: "p1", options: ["yes", "no"], default: "no" }, { playerId: "p2", options: ["red", "green", "blue"], default: "red" }] }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "yes" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "no" }),
      V({ type: "timeout", playerId: "system", decisionId: "d1" }),
      V({ type: "decision/open", playerId: "system", prompts: [{ playerId: "p2", options: ["a", "b"], default: "a" }] }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "c" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d2", choice: "b" }),
    ],
  },
  "combat-golden": {
    rules: "test",
    settings: { v: 2, seed: "combat-golden", players: [{ id: "p1", classId: "fighter" }, { id: "p2", classId: "caster" }] },
    actions: [
      V({ type: "system/setCharacter", playerId: "system", target: "p1", classId: "battlemage", level: 1, weapon: "stick", shield: "mirror", accessory: "band", battleSpell: "jolt", wardSpell: "mirror-ward", bag: ["herb", "tonic"] }),
      V({ type: "combat/start", playerId: "system", attacker: "p1", opponent: { kind: "player", playerId: "p2" } }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "spell" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d1", choice: "counter" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d2", choice: "item:tonic" }),
      V({ type: "timeout", playerId: "system", decisionId: "d2" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d3", choice: "spell" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d3", choice: "ward" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d4", choice: "strike" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d4", choice: "counter" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d5", choice: "item:bomb" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d5", choice: "guard" }),
      V({ type: "combat/start", playerId: "system", attacker: "p2", opponent: { kind: "npc", npc: { kind: "monster", id: "gull", senior: false } } }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d6", choice: "guard" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d7", choice: "attack" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d8", choice: "counter" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d9", choice: "spell" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d10", choice: "strike" }),
    ],
  },
  "rewards-golden": {
    rules: "test",
    settings: { v: 2, seed: "rewards-golden", players: [{ id: "p1", classId: "fighter" }, { id: "p2", classId: "caster" }] },
    actions: [
      V({ type: "system/grant", playerId: "system", target: "p1", grant: { kind: "item", id: "tonic" } }),
      V({ type: "combat/start", playerId: "system", attacker: "p1", opponent: { kind: "npc", npc: { kind: "monster", id: "slime", senior: false } } }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d1", choice: "strike" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d2", choice: "guard" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d3", choice: "strike" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d4", choice: "guard" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d5", choice: "attack" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d6", choice: "counter" }),
      V({ type: "loadout/useItem", playerId: "p1", itemId: "herb" }),
      V({ type: "combat/start", playerId: "system", attacker: "p2", opponent: { kind: "player", playerId: "p1" } }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d7", choice: "strike" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d7", choice: "counter" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d8", choice: "spell" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d8", choice: "guard" }),
      V({ type: "decision/commit", playerId: "p2", decisionId: "d9", choice: "spell" }),
      V({ type: "decision/commit", playerId: "p1", decisionId: "d9", choice: "counter" }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "xp", amount: 150 } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "gold", amount: 200 } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "item", id: "antidote" } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "item", id: "wig" } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "scroll", id: "haste" } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "gear", id: "sword" } }),
      V({ type: "system/grant", playerId: "system", target: "p2", grant: { kind: "wardSpell", id: "sponge" } }),
      V({ type: "loadout/switchClass", playerId: "p2", classId: "fighter", discard: ["wig"] }),
      V({ type: "loadout/discard", playerId: "p1", itemId: "tonic" }),
    ],
  },
  "combat-game": {
    rules: "content",
    settings: { v: 2, seed: "sim-fixture", players: [{ id: "a", classId: "warrior" }, { id: "b", classId: "mage" }] },
    actions: [
      V({ type: "system/setCharacter", playerId: "system", target: "a", classId: "warrior", level: 5, weapon: "bronze-blade", shield: "buckler", accessory: "lucky-sock", battleSpell: "spark", wardSpell: null, bag: ["herb", "smoke-bomb", "battle-tonic"] }),
      V({ type: "system/setCharacter", playerId: "system", target: "b", classId: "mage", level: 5, weapon: "wooden-sword", shield: "buckler", accessory: "mage-ring", battleSpell: "fireball", wardSpell: "barrier", bag: ["herb"] }),
      V({ type: "combat/start", playerId: "system", attacker: "a", opponent: { kind: "npc", npc: { kind: "monster", id: "seagull-debt-collector", senior: false } } }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d1", choice: "guard" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d2", choice: "item:smoke-bomb" }),
      V({ type: "combat/start", playerId: "system", attacker: "b", opponent: { kind: "player", playerId: "a" } }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d3", choice: "spell" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d3", choice: "ward" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d4", choice: "attack" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d4", choice: "guard" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d5", choice: "attack" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d5", choice: "guard" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d6", choice: "item:herb" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d6", choice: "guard" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d7", choice: "spell" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d7", choice: "guard" }),
      V({ type: "decision/commit", playerId: "a", decisionId: "d8", choice: "attack" }),
      V({ type: "timeout", playerId: "system", decisionId: "d8" }),
      V({ type: "combat/start", playerId: "system", attacker: "b", opponent: { kind: "npc", npc: { kind: "guardian", id: "landlord-lich", townTier: 1 } } }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d9", choice: "spell" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d10", choice: "ward" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d11", choice: "strike" }),
      V({ type: "decision/commit", playerId: "b", decisionId: "d12", choice: "counter" }),
    ],
  },
};
const rulesOf = (k) => (k === "test" ? TEST_RULES : RULES);

// Per-action trace: {i, type, ok, error, hash (after the action; input hash on rejection), events (full, in order)}
export function traceScenario(name) {
  const sc = SCENARIOS[name];
  const R = rulesOf(sc.rules);
  let s = createGame(sc.settings, R);
  const steps = [];
  const all = [];
  const rejections = [];
  sc.actions.forEach((a, i) => {
    const r = reduce(s, a, R);
    if (r.ok) {
      s = r.state;
      all.push(...r.events);
    } else rejections.push({ index: i, code: r.error.code });
    steps.push({ i, type: a.type, ok: r.ok, error: r.ok ? null : r.error.code, hash: hashState(s), events: r.ok ? r.events : [] });
  });
  return {
    trace: { scenario: name, rules: sc.rules === "test" ? "TEST_RULES" : "content", rulesHash: rulesHash(R), settings: sc.settings, initialHash: hashState(createGame(sc.settings, R)), steps, finalHash: hashState(s), finalState: JSON.parse(stableStringify(s)) },
    state: s, events: all, rejections, R,
  };
}

function compressTypes(types) {
  const out = [];
  for (const t of types) {
    const last = out.at(-1);
    if (last && last.t === t) last.n++;
    else out.push({ t, n: 1 });
  }
  return out.map(({ t, n }) => (n > 1 ? `${t}×${n}` : t)).join(", ");
}

function exchangeRows(events) {
  const rows = [];
  let k = 0;
  for (const e of events) {
    if (e.type === "ExchangeResolved") {
      k++;
      rows.push(`| ${k} | ${e.combatId} | ${e.round}.${e.exchange} | ${e.attacker} | ${e.command} / ${e.defense} | [${e.damage}] | [${e.heal}] | ${e.effects.length ? e.effects.map((x) => "`" + x + "`").join(", ") : "—"} | [${e.hp}] |`);
    } else if (e.type === "ExchangeSkipped") rows.push(`| — | ${e.combatId} | ${e.round}.${e.exchange} | ${e.attacker} | \`ExchangeSkipped\` (stunned) | | | | |`);
    else if (e.type === "CombatEnded") rows.push(`| end | ${e.combatId} | — | — | \`CombatEnded ${e.outcome}\` winner ${e.winner} fled ${e.fled} | | | | [${e.hp}] |`);
  }
  return rows.join("\n");
}

function scenarioSummary(name) {
  const t = traceScenario(name);
  const s = t.state;
  const types = t.events.map((e) => e.type);
  const firsts = {};
  for (const e of t.events) if (e.type === "RoundStarted") (firsts[e.combatId] ??= []).push(e.first);
  return {
    t,
    line: `${t.rejections.length} rejections (${J(t.rejections)}), ${t.events.length} events, final hashState = ${hashState(s)}`,
    rows: exchangeRows(t.events),
    types: compressTypes(types),
    firsts: Object.entries(firsts).map(([c, f]) => `${c} \`first\` = ${f.join(", ")}`).join("; "),
    hidden: J(s.hidden),
    choiceHistory: J(s.public.choiceHistory),
    characters: Object.fromEntries(Object.entries(s.public.characters).map(([p, c]) => [p, `${c.classId} L${c.level} xp ${c.xp} gold ${c.gold} hp ${c.hp} bag ${J(s.private[p].bag)} scrolls ${J(s.private[p].scrolls)}`])),
    rewards: t.events.filter((e) => ["VictoryRewarded", "LevelUp", "MasteryRankUp", "HybridUnlocked", "ItemUsed", "ClassSwitched"].includes(e.type)).map((e) => { const { v, visibility, ...x } = e; return J(x); }).join("; "),
  };
}

// ---------------------------------------------------------------- stats (TEST_RULES)
function statsRows() {
  const R = TEST_RULES;
  const m = (o = {}) => ({ battlemage: 0, caster: 0, fighter: 0, ...o });
  const C = (classId, level, weapon, shield, accessory, mastery = {}, portable = null) => ({ classId, level, mastery: m(mastery), portable, weapon, shield, accessory });
  const rows = [
    ["fighter L1, stick/lid/—", sheetStats(R, C("fighter", 1, "stick", "lid", null))],
    ["caster L1, stick/lid/charm", sheetStats(R, C("caster", 1, "stick", "lid", "charm"))],
    ["battlemage L1, stick/mirror/band", sheetStats(R, C("battlemage", 1, "stick", "mirror", "band"))],
    ["fighter L5, sword/lid/—, fighter wins 3 (rank 2: `strikeDmgBp`, `hpBp`)", sheetStats(R, C("fighter", 5, "sword", "lid", null, { fighter: 3 }))],
    ["caster L3, stick/lid/—, caster wins 7 (rank 3), fighter wins 18 (rank 5), portable `fighter`", sheetStats(R, C("caster", 3, "stick", "lid", null, { fighter: 18, caster: 7 }, "fighter"))],
    ["battlemage L4, sword/lid/—, battlemage wins 7 (rank 3: `atkBp` active)", sheetStats(R, C("battlemage", 4, "sword", "lid", null, { battlemage: 7 }))],
    ["monster `slime`", npcStats(R, { kind: "monster", id: "slime", senior: false })],
    ["monster `crab`, senior (T3 curve)", npcStats(R, { kind: "monster", id: "crab", senior: true })],
    ["monster `gull`", npcStats(R, { kind: "monster", id: "gull", senior: false })],
    ["guardian `lich`, townTier 2 (T3 curve)", npcStats(R, { kind: "guardian", id: "lich", townTier: 2 })],
    ["enforcer level 5", npcStats(R, { kind: "enforcer", level: 5 })],
  ];
  return rows.map(([l, s]) => `| ${l} | ${st(s)} |`).join("\n");
}

// content NPC spot checks (npc.test.ts)
function contentNpcRows() {
  const R = RULES;
  const rows = [
    ["monster `ogre-middle-manager` (T4)", npcStats(R, { kind: "monster", id: "ogre-middle-manager", senior: false })],
    ["monster `slime-intern`, senior (T2 curve)", npcStats(R, { kind: "monster", id: "slime-intern", senior: true })],
    ["guardian `landlord-lich`, townTier 1 (T2 curve)", npcStats(R, { kind: "guardian", id: "landlord-lich", townTier: 1 })],
    ["enforcer level 10", npcStats(R, { kind: "enforcer", level: 10 })],
  ];
  return rows.map(([l, s]) => `| ${l} | ${st(s)} |`).join("\n");
}

// ---------------------------------------------------------------- matrix
function matrix() {
  const R = TEST_RULES;
  const mk = (stats, hooks, spell, ward) => ({ stats, hp: stats.hp, maxHp: stats.hp, h: applyPassives(hooks), spell, ward });
  const ATTS = { hp: 100, atk: 30, def: 20, mag: 24, spd: 10, luck: 8 };
  const DEFS = { hp: 90, atk: 26, def: 18, mag: 20, spd: 9, luck: 4 };
  const spell = { powerBp: 12000, effect: { kind: "none" } };
  const A = (hooks = [], sp = spell) => mk(ATTS, hooks, sp, null);
  const D = (hooks = [], ward = null) => mk(DEFS, hooks, null, ward);
  const cell = (att, def, a, d) => ({ n: computeCell(R, att, def, a, d, false), c: computeCell(R, att, def, a, d, true) });
  const mult = { attack: { guard: 5000, counter: 12500, ward: 10000, open: 10000 }, strike: { guard: 15000, counter: 10000, ward: 17500, open: 15000 }, spell: { guard: 10000, counter: 10000, ward: 10000, open: 10000 } };
  const note = { "attack/counter": " — failed Counter", "strike/guard": " — pierces Guard", "spell/ward": " — **no ward spell: Guard multiplier (D2)**" };
  const lines = ["| Attacker \\ Defender | Guard (m) | Counter (m) | Ward (m) | Open (m) |", "|---|---|---|---|---|"];
  for (const a of ["attack", "strike", "spell"]) {
    const cells = ["guard", "counter", "ward", "open"].map((d) => {
      const { n, c } = cell(A(), D(), a, d);
      if (a === "strike" && d === "counter") return `reflection 10000 → **attacker takes ${n.toAtt}**, defender 0 (no crit)`;
      const crit = a === "spell" ? (n.effectLands ? ", effectLands" : ", no effect") : ` (crit ${c.toDef})`;
      return `${mult[a][d]} → **${n.toDef}**${crit}${note[a + "/" + d] ?? ""}`;
    });
    lines.push(`| **${a[0].toUpperCase() + a.slice(1)}** | ${cells.join(" | ")} |`);
  }
  const fmt = (label, cellName, att, def, a, d) => {
    const { n, c } = cell(att, def, a, d);
    const parts = [`${n.toDefender ?? n.toDef} / ${n.toAtt}`];
    if (n.healAtt) parts.push(`heal att ${n.healAtt}`);
    if (n.healDef) parts.push(`heal def ${n.healDef}`);
    if (n.tags.length) parts.push(n.tags.map((t) => "`" + t + "`").join(", "));
    if (a === "spell" || (a === "strike" && att.h.spellbladeStrike > 0)) parts.push(`effectLands ${n.effectLands}`);
    const critCol = a === "spell" || (a === "strike" && d === "counter") ? "n/a" : String(c.toDef);
    return `| ${label} | ${cellName} | ${parts.join(" / ")} | ${critCol} |`;
  };
  const W = R.wardSpells;
  const H = (hook, value) => [{ hook, value }];
  const v = [
    fmt("att `strikeDmgBp +1000`", "Strike×Ward", A(H("strikeDmgBp", 1000)), D(), "strike", "ward"),
    fmt("def `guardVsStrikeBp 5000` (Warrior r5)", "Strike×Guard", A(), D(H("guardVsStrikeBp", 5000)), "strike", "guard"),
    fmt("def `counterDmgBp +2000`", "Strike×Counter", A(), D(H("counterDmgBp", 2000)), "strike", "counter"),
    fmt("def `spellTakenBp −2000` (Mirror Shield)", "Spell×Guard", A(), D(H("spellTakenBp", -2000)), "spell", "guard"),
    fmt("def `physTakenBp −5000` (Wisp)", "Attack×Ward", A(), D(H("physTakenBp", -5000)), "attack", "ward"),
    fmt("def ward Barrier (`shell`, the 0.4× baseline)", "Spell×Ward", A(), D([], W.shell), "spell", "ward"),
    fmt("def ward Barrier", "Attack×Ward", A(), D([], W.shell), "attack", "ward"),
    fmt("def ward Reflect (`mirror-ward`, 5000)", "Spell×Ward", A(), D([], W["mirror-ward"]), "spell", "ward"),
    fmt("def ward Absorb (`sponge`)", "Spell×Ward", A(), D([], W.sponge), "spell", "ward"),
    fmt("def ward Counterspell (`null-ward`, 12500)", "Spell×Ward", A(), D([], W["null-ward"]), "spell", "ward"),
    fmt("def ward Counterspell", "Attack×Ward", A(), D([], W["null-ward"]), "attack", "ward"),
    fmt("def ward Counterspell", "Strike×Ward", A(), D([], W["null-ward"]), "strike", "ward"),
    fmt("def `wardReflectBp 5000`, no ward spell (Cleric r5)", "Spell×Ward", A(), D(H("wardReflectBp", 5000)), "spell", "ward"),
    fmt("def `wardReflectBp 5000` + ward Barrier", "Spell×Ward", A(), D(H("wardReflectBp", 5000), W.shell), "spell", "ward"),
    fmt("att spell Hex (power 0)", "Spell×Guard", A([], R.battleSpells.hex), D(), "spell", "guard"),
    fmt("att spell Hex, def no ward spell", "Spell×Ward", A([], R.battleSpells.hex), D(), "spell", "ward"),
    fmt("att spell Leech (power 8000, drain 5000)", "Spell×Counter", A([], R.battleSpells.leech), D(), "spell", "counter"),
    fmt("att spell Leech, def no ward spell", "Spell×Ward", A([], R.battleSpells.leech), D(), "spell", "ward"),
    fmt("att `lifestealBp 2000`", "Attack×Counter", A(H("lifestealBp", 2000)), D(), "attack", "counter"),
    fmt("att `spellbladeStrike 5000`", "Strike×Guard", A(H("spellbladeStrike", 5000)), D(), "strike", "guard"),
    fmt("att `spellbladeStrike 5000`", "Strike×Ward", A(H("spellbladeStrike", 5000)), D(), "strike", "ward"),
    fmt("att `spellbladeStrike 5000`", "Strike×Counter", A(H("spellbladeStrike", 5000)), D(), "strike", "counter"),
    fmt("att `atk 1` (min-1 rule)", "Attack×Guard", mk({ ...ATTS, atk: 1 }, [], spell, null), D(), "attack", "guard"),
  ];
  return { table: lines.join("\n"), variants: ["| Variant | Cell | Result (no crit): toDefender / toAttacker / extras | Crit toDefender |", "|---|---|---|---|", ...v].join("\n"), crit: critChance(R, A()) };
}

// ---------------------------------------------------------------- AI
function aiGoldens() {
  const R = TEST_RULES;
  let s = createGame({ v: 2, seed: "ai", players: [{ id: "p1", classId: "fighter" }, { id: "p2", classId: "caster" }] }, R);
  s = reduce(s, { v: 2, type: "combat/start", playerId: "system", attacker: "p1", opponent: { kind: "player", playerId: "p2" } }, R).state;
  const withHist = (h) => (h ? { ...s, public: { ...s.public, choiceHistory: { p1: h, p2: h } } } : s);
  const Z = { attack: 0, strike: 0, spell: 0, guard: 0, counter: 0, ward: 0 };
  const rows = [];
  const fmtEv = (ev) => ev.map((x) => String(+x.toFixed(6)).replace("-", "−")).join(", ");
  const row = (label, st2, pid, d, evSame) => {
    const p = combatPolicy(viewFor(st2, pid), R, d);
    rows.push(`| ${label} | ${pid} | ${d} | ${p.commands.join(", ")} | ${p.weights.join(", ")} | ${p.ev ? (evSame ? "same" : fmtEv(p.ev)) : "—"} |`);
  };
  for (const pid of ["p1", "p2"]) for (const d of ["easy", "normal", "hard"]) row("all 0", s, pid, d, d === "hard");
  row("`strike: 20`", withHist({ ...Z, strike: 20 }), "p2", "hard", false);
  row("`guard: 20`", withHist({ ...Z, guard: 20 }), "p1", "hard", false);
  const decide = [];
  for (const pid of ["p1", "p2"]) for (const d of ["easy", "normal", "hard"]) {
    const out = decideCombat(viewFor(s, pid), R, createAi("ai", pid, d));
    decide.push({ pid, d, choice: out.action.choice, rng: out.ai.rng });
  }
  // normal must ignore history
  for (const pid of ["p1", "p2"]) {
    const a = combatPolicy(viewFor(s, pid), R, "normal"), b = combatPolicy(viewFor(withHist({ ...Z, strike: 20 }), pid), R, "normal"), c = combatPolicy(viewFor(withHist({ ...Z, guard: 20 }), pid), R, "normal");
    if (J(a) !== J(b) || J(a) !== J(c)) throw new Error("normal policy depends on history");
  }
  const choices = ["p1", "p2"].map((pid) => `${pid} ${decide.filter((x) => x.pid === pid).map((x) => `${x.d} \`${x.choice}\``).join(" / ")}`).join("; ");
  const rngs = decide.map((x) => `${x.pid} ${x.d} \`${J(x.rng)}\``).join(", ");
  return { table: ["| choiceHistory (both players) | viewer | difficulty | commands | weights | ev (6 dp) |", "|---|---|---|---|---|---|", ...rows, "| `strike: 20` or `guard: 20` | any | normal | unchanged from the all-0 rows (Normal ignores history) | | |"].join("\n"), choices, rngs };
}

// ---------------------------------------------------------------- sim stdout (the report format of the CLI)
export function simReport(R, { n, seed = "usurpia", level = 5, matchup = "all", difficulty = "normal" }) {
  const [dA, dB] = difficulty.includes(":") ? difficulty.split(":") : [difficulty, difficulty];
  const cls = Object.keys(R.classes).sort(), mons = Object.keys(R.monsters).sort();
  const classes = [], monsters = [];
  for (const a of cls) for (const b of cls) classes.push({ a, b: { kind: "class", id: b }, group: "class-vs-class" });
  for (const a of cls) for (const m of mons) monsters.push({ a, b: { kind: "monster", id: m }, group: "class-vs-monster" });
  const M = matchup === "all" ? [...classes, ...monsters] : matchup === "classes" ? classes : matchup === "monsters" ? monsters : matchup === "mirrors" ? cls.map((c) => ({ a: c, b: { kind: "class", id: c }, group: "class-vs-class" })) : null;
  const stats = M.map(() => ({ n: 0, a: 0, b: 0, draw: 0, fled: 0 }));
  for (let i = 0; i < n; i++) {
    const k = i % M.length, m = M[k];
    const e = duel(R, `${seed}/${i}`, { kind: "class", id: m.a }, m.b, dA, dB, level).end;
    const x = stats[k];
    x.n++;
    if (e.outcome === "ko") { if (e.winner === 0) x.a++; else x.b++; } else if (e.outcome === "draw") x.draw++; else x.fled++;
  }
  const out = [`duel n=${n} seed=${seed} level=${level} difficulty=${dA}:${dB} rules=${rulesHash(R)}`];
  let group = "";
  const tot = { a: 0, b: 0, draw: 0, fled: 0 };
  M.forEach((m, k) => {
    const x = stats[k];
    if (x.n === 0) return;
    if (m.group !== group) { group = m.group; out.push("# " + group); }
    const name = m.b.kind === "class" ? `${m.a}:${m.b.id}` : `${m.a}:monster/${m.b.id}`;
    out.push(`${name} n=${x.n} a=${x.a} b=${x.b} draw=${x.draw} fled=${x.fled} aRate=${x.a + x.b > 0 ? (x.a / (x.a + x.b)).toFixed(3) : "n/a"}`);
    tot.a += x.a; tot.b += x.b; tot.draw += x.draw; tot.fled += x.fled;
  });
  out.push(`total n=${n} a=${tot.a} b=${tot.b} draw=${tot.draw} fled=${tot.fled}`);
  return out.join("\n");
}

// ---------------------------------------------------------------- gate
export const GATE_CLASSES = ["cleric", "mage", "shadowpriest", "spellblade", "thief", "warrior"];
export function gate(R, { n = 400, traceFirst = 20 } = {}) {
  const rows = [], traces = {};
  for (const c of GATE_CLASSES) {
    let hw = 0, ew = 0, dr = 0, fl = 0;
    const tr = [];
    for (let j = 0; j < n; j++) {
      const hardA = j % 2 === 0;
      const seed = `gate/${c}/${j}`;
      const r = duel(R, seed, { kind: "class", id: c }, { kind: "class", id: c }, hardA ? "hard" : "easy", hardA ? "easy" : "hard", 5);
      const e = r.end, hs = hardA ? 0 : 1;
      if (e.outcome === "ko") { if (e.winner === hs) hw++; else ew++; } else if (e.outcome === "draw") dr++; else fl++;
      // every gate duel is replayed with the 02-04 reward hook disabled: outcomes must not depend on rewards
      setRewardsEnabled(false);
      const r0 = duel(R, seed, { kind: "class", id: c }, { kind: "class", id: c }, hardA ? "hard" : "easy", hardA ? "easy" : "hard", 5);
      setRewardsEnabled(true);
      if (r0.end.outcome !== e.outcome || r0.end.winner !== e.winner || r0.end.fled !== e.fled) throw new Error("rewards changed an outcome");
      if (j < traceFirst) {
        tr.push({ j, seed, hardSide: hs, outcome: e.outcome, winner: e.winner, fled: e.fled, hp: e.hp, events: r.events.length, hash: r.hash, eventsPreRewards: r0.events.length, hashPreRewards: r0.hash });
      }
    }
    const dec = hw + ew;
    rows.push({ c, hw, ew, dr, fl, dec, rate: hw / dec, drawRate: dr / n });
    traces[c] = tr;
  }
  const table = ["| class | hardWins | easyWins | draws | fled | decisive | Hard-decisive rate | draw rate |", "|---|---|---|---|---|---|---|---|", ...rows.map((r) => `| ${r.c} | ${r.hw} | ${r.ew} | ${r.dr} | ${r.fl} | ${r.dec} | ${r.rate.toFixed(3)} | ${r.drawRate.toFixed(3)} |`)].join("\n");
  return { rows, table, traces };
}

// ---------------------------------------------------------------- everything
export function computeGoldens({ withGate = true } = {}) {
  const snippets = {};
  const traces = {};
  snippets.rulesHashTest = `rulesHash(TEST_RULES) = ${rulesHash(TEST_RULES)}`;
  snippets.rulesHashContent = `rulesHash(loadRules()) === "${rulesHash(RULES)}"`;
  const g0 = createGame(SCENARIOS["kernel-game"].settings, TEST_RULES);
  snippets.createGame = `hashState = ${hashState(g0)}`;
  snippets.createGameJson = stableStringify(g0);
  snippets.stats = statsRows();
  snippets.contentNpc = contentNpcRows();
  const mx = matrix();
  snippets.matrix = mx.table;
  snippets.variants = mx.variants;
  snippets.crit = `critChanceBp(att) = ${mx.crit}`;
  const ai = aiGoldens();
  snippets.aiTable = ai.table;
  snippets.aiChoices = ai.choices;
  snippets.aiRngs = ai.rngs;
  const summaries = {};
  for (const name of Object.keys(SCENARIOS)) {
    const sm = scenarioSummary(name);
    summaries[name] = sm;
    traces[`${name}.trace.json`] = sm.t.trace;
    snippets[`${name}.line`] = sm.line;
    snippets[`${name}.rows`] = sm.rows;
    snippets[`${name}.types`] = sm.types;
  }
  const kg = summaries["kernel-game"].t;
  snippets.kernelSimLine = `hash=${hashState(kg.state)} rules=${rulesHash(TEST_RULES)} turn=${kg.state.public.turn} events=${kg.events.length} rejections=${kg.rejections.length}`;
  const cg = summaries["combat-game"].t;
  snippets.combatGameLine = `hash=${hashState(cg.state)} rules=${rulesHash(RULES)} turn=${cg.state.public.turn} events=${cg.events.length} rejections=${cg.rejections.length}`;
  snippets.mirrors = simReport(RULES, { n: 60, matchup: "mirrors", difficulty: "hard:easy", seed: "golden" });
  snippets.classesTotal = simReport(RULES, { n: 36, matchup: "classes", seed: "golden" }).split("\n").at(-1);
  snippets.smoke = simReport(RULES, { n: 264, seed: "ci" }).split("\n").at(-1);
  if (withGate) snippets.perf = simReport(RULES, { n: 10000, seed: "perf" }).split("\n").at(-1);
  if (withGate) {
    const gt = gate(RULES);
    snippets.gate = gt.table;
    traces["gate.trace.json"] = { rulesHash: rulesHash(RULES), n: 400, level: 5, note: "first 20 duels per class; hash = hashState of the final duel state with 02-04 rewards (W3 final); hashPreRewards = same duel with the reward hook disabled (W2 engine)", classes: gt.traces };
    snippets.gateRows = gt.rows;
  }
  return { snippets, traces, summaries };
}
