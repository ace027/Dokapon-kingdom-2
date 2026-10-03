// Phase 3 map generator + invariant checker (scratch/bootstrap; frozen after 03-01 commits map.tiled.json).
// usage: node gen-map.mjs --tiled > map.tiled.json | node gen-map.mjs --stats | node gen-map.mjs --check file.json
import { readFileSync } from "node:fs";
const SEED = 20260926;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(SEED);
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const ZONES = ["enchanted-forest", "soggy-coast", "goblin-mines", "bureaucrat-bog"];
const ZONE_SIZE = [14, 18, 20, 22]; // excl. castle; bog includes the lair
const RINGS = [6, 11, 16, 20, 21];
// zone x type counts; columns sum to the global mix (battle 22, item 6, loot 4, gold 6, town 10, event 8, empty 4, shop 4, temple 3, shrine 2, warp 4, lair 1)
const MIX = {
  battle: [3, 4, 7, 8], item: [2, 2, 1, 1], loot: [0, 1, 1, 2], gold: [1, 2, 2, 1], town: [2, 3, 3, 2],
  event: [2, 2, 2, 2], empty: [1, 1, 1, 1], shop: [1, 1, 1, 1], temple: [1, 1, 0, 1], shrine: [0, 0, 1, 1],
  warp: [1, 1, 1, 1], lair: [0, 0, 0, 1],
};
const TOWNS = [
  ["thistledown", 500], ["mudwick", 600], ["brinewick", 700], ["gullhaven", 800], ["soggyton", 900],
  ["slagpit", 1000], ["gildhollow", 1100], ["pickaxe-rest", 1200], ["ledgerfen", 1300], ["fogbottom", 1500],
];
const GUARDIANS = ["landlord-lich", "tollbridge-troll", "knight-of-foreclosure"];
const W = 1280, H = 768, CX = 640, CY = 384;

function layout() {
  const nodes = [{ ring: 0, x: CX, y: CY, ang: 0 }];
  RINGS.forEach((n, k) => {
    const ring = k + 1; const rad = [95, 165, 235, 300, 345][k];
    const off = R() * 0.5;
    for (let i = 0; i < n; i++) {
      const ang = (2 * Math.PI * (i + off + (R() - 0.5) * 0.35)) / n;
      const rr = rad + (R() - 0.5) * 22;
      nodes.push({ ring, x: Math.round(CX + Math.cos(ang) * rr * 1.7), y: Math.round(CY + Math.sin(ang) * rr), ang });
    }
  });
  nodes.forEach((n, i) => (n.i = i));
  return nodes;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function cross(p1, p2, p3, p4) {
  const d = (a, b, c) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  if ([p1, p2].some((p) => [p3, p4].includes(p))) return false;
  return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
}
function edges(nodes) {
  const E = []; const deg = nodes.map(() => 0); const has = new Set();
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const can = (a, b, cap) => a !== b && !has.has(key(a, b)) && deg[a] < cap && deg[b] < cap &&
    !E.some(([c, d]) => cross(nodes[a], nodes[b], nodes[c], nodes[d]));
  const add = (a, b) => { E.push([Math.min(a, b), Math.max(a, b)]); has.add(key(a, b)); deg[a]++; deg[b]++; };
  const byRing = (r) => nodes.filter((n) => n.ring === r);
  for (let i = 1; i <= 6; i++) add(0, nodes[i].i); // castle spokes
  RINGS.forEach((_, k) => { // ring cycle edges (skip ~15%)
    const ring = byRing(k + 1).sort((a, b) => ((a.ang % 6.2832) + 6.2832) % 6.2832 - (((b.ang % 6.2832) + 6.2832) % 6.2832));
    ring.forEach((n, j) => { const m = ring[(j + 1) % ring.length]; if (R() > 0.15 && can(n.i, m.i, 4)) add(n.i, m.i); });
  });
  for (let r = 2; r <= 5; r++) { // spokes inward, then fill
    for (const n of byRing(r)) { const inner = byRing(r - 1).sort((a, b) => dist(a, n) - dist(b, n)); for (const m of inner.slice(0, 3)) if (can(n.i, m.i, 4)) { add(n.i, m.i); break; } }
    for (const m of byRing(r - 1)) { if (E.some(([a, b]) => (a === m.i && nodes[b].ring === r) || (b === m.i && nodes[a].ring === r))) continue; const outer = byRing(r).sort((a, b) => dist(a, m) - dist(b, m)); for (const n of outer) if (can(m.i, n.i, 4)) { add(m.i, n.i); break; } }
  }
  const cand = []; for (let a = 1; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) if (Math.abs(nodes[a].ring - nodes[b].ring) <= 1) cand.push([a, b, dist(nodes[a], nodes[b])]);
  cand.sort((p, q) => p[2] - q[2]);
  for (const [a, b, d] of cand) { if (d > 150) break; if (R() < 0.45 && can(a, b, 3)) add(a, b); } // extra chords => web
  for (let pass = 0; pass < 3; pass++) for (const n of nodes) { // min degree 2
    if (deg[n.i] >= 2) continue; const near = nodes.filter((m) => m !== n).sort((a, b) => dist(a, n) - dist(b, n));
    for (const m of near) if (can(n.i, m.i, 5)) { add(n.i, m.i); if (deg[n.i] >= 2) break; }
  }
  return E;
}
function bfs(adj, s) { const d = new Array(adj.length).fill(-1); d[s] = 0; const q = [s]; for (let h = 0; h < q.length; h++) for (const m of adj[q[h]]) if (d[m] < 0) { d[m] = d[q[h]] + 1; q.push(m); } return d; }
const adjOf = (n, E) => { const a = Array.from({ length: n }, () => []); E.forEach(([x, y]) => { a[x].push(y); a[y].push(x); }); return a; };

export function build() {
  const nodes = layout(); let E = edges(nodes); let adj = adjOf(nodes.length, E);
  // connect components (should already be connected)
  for (;;) { const d = bfs(adj, 0); const out = d.findIndex((x) => x < 0); if (out < 0) break; const inn = nodes.filter((n, i) => d[i] >= 0).sort((a, b) => dist(a, nodes[out]) - dist(b, nodes[out]))[0]; E.push([Math.min(inn.i, out), Math.max(inn.i, out)]); adj = adjOf(nodes.length, E); }
  const dc = bfs(adj, 0);
  // zones: sort by ring + jitter (blend), cut into sizes
  const order = nodes.slice(1).map((n) => ({ n, k: dc[n.i] + (R() - 0.5) * 2.2 })).sort((a, b) => a.k - b.k);
  let p = 0; ZONE_SIZE.forEach((sz, z) => { for (let j = 0; j < sz; j++) order[p++].n.zone = z; });
  nodes[0].zone = 0; nodes[0].space = "castle";
  const farthest = (cands, chosen, minD) => { // farthest-point sampling by graph distance
    let best = null, bs = -1; for (const c of cands) { const dd = bfs(adj, c.i); const m = Math.min(dd[0] * 0.6, ...chosen.map((x) => dd[x.i]), 99); if (m > bs) { bs = m; best = c; } } return best; };
  const free = (z) => nodes.filter((n) => n.zone === z && !n.space);
  // lair: bog node with max castle distance and degree >= 2
  const bog = free(3).filter((n) => adj[n.i].length >= 2).sort((a, b) => dc[b.i] - dc[a.i] || a.i - b.i); bog[0].space = "lair";
  const placed = { town: [], temple: [], shop: [], shrine: [], warp: [] };
  for (const type of ["town", "temple", "shop", "shrine"]) for (let z = 0; z < 4; z++) for (let c = 0; c < MIX[type][z]; c++) {
    const cands = free(z).filter((n) => !(type === "town" && adj[n.i].includes(0)));
    const pick = farthest(cands, placed[type].concat(type === "town" ? [] : []), 0); pick.space = type; placed[type].push(pick); }
  // warps: pair A forest<->mines, pair B coast<->bog, far apart
  const wz = [[0, 2], [1, 3]]; const pairs = [];
  for (const [za, zb] of wz) { const a = farthest(free(za), placed.warp, 0); a.space = "warp"; placed.warp.push(a); const da = bfs(adj, a.i); const b = free(zb).sort((x, y) => da[y.i] - da[x.i] || x.i - y.i)[0]; b.space = "warp"; placed.warp.push(b); pairs.push([a, b]); }
  for (const [a, b] of pairs) { a.warpTo = b.i; b.warpTo = a.i; }
  for (let z = 0; z < 4; z++) { const pool = []; for (const t of ["battle", "item", "loot", "gold", "event", "empty"]) for (let c = 0; c < MIX[t][z]; c++) pool.push(t); const f = shuffle(free(z)); if (f.length !== pool.length) throw new Error(`zone ${z}: ${f.length} free vs ${pool.length} pool`); const sp = shuffle(pool); f.forEach((n, j) => (n.space = sp[j])); }
  // towns: id/value by zone then castle distance
  const tz = [[], [], [], []]; nodes.filter((n) => n.space === "town").sort((a, b) => dc[a.i] - dc[b.i] || a.i - b.i).forEach((n) => tz[n.zone].push(n));
  let ti = 0; tz.forEach((list) => list.forEach((n) => { [n.town, n.baseValue] = TOWNS[ti]; n.guardian = GUARDIANS[ti % 3]; ti++; }));
  nodes.forEach((n) => { n.id = "n" + String(n.i + 1).padStart(2, "0"); });
  return { nodes, E, adj, dc };
}

export function toTiled({ nodes, E }) {
  const id = (n) => n.id; let oid = 1; const oidOf = {};
  const objs = nodes.map((n) => { oidOf[n.id] = oid; const props = [["space", "string", n.space], ["zone", "string", ZONES[n.zone]], ["tier", "int", n.zone + 1]];
    if (n.town) props.push(["town", "string", n.town], ["baseValue", "int", n.baseValue], ["guardian", "string", n.guardian]);
    if (n.warpTo !== undefined) props.push(["warp", "string", nodes[n.warpTo].id]);
    return { id: oid++, name: n.id, type: "node", x: n.x, y: n.y, width: 0, height: 0, rotation: 0, visible: true, point: true, properties: props.map(([name, type, value]) => ({ name, type, value })) }; });
  const eobjs = E.map(([a, b]) => ({ id: oid++, name: `${nodes[a].id}-${nodes[b].id}`, type: "edge", x: nodes[a].x, y: nodes[a].y, width: 0, height: 0, rotation: 0, visible: true, polyline: [{ x: 0, y: 0 }, { x: nodes[b].x - nodes[a].x, y: nodes[b].y - nodes[a].y }], properties: [{ name: "from", type: "string", value: nodes[a].id }, { name: "to", type: "string", value: nodes[b].id }] }));
  return { compressionlevel: -1, height: H / 32, width: W / 32, infinite: false, orientation: "orthogonal", renderorder: "right-down", tiledversion: "1.10.2", version: "1.10", type: "map", tilewidth: 32, tileheight: 32, nextlayerid: 3, nextobjectid: oid,
    layers: [{ id: 1, name: "nodes", type: "objectgroup", draworder: "topdown", opacity: 1, visible: true, x: 0, y: 0, objects: objs }, { id: 2, name: "edges", type: "objectgroup", draworder: "topdown", opacity: 1, visible: true, x: 0, y: 0, objects: eobjs }] };
}

// ---- invariant checker over the FLAT form {nodes:[{id,space,zone,tier,town?,warp?}],edges:[[a,b]]}
export function flatFromTiled(t) {
  const props = (o) => Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
  const nodes = t.layers.find((l) => l.name === "nodes").objects.map((o) => ({ id: o.name, x: o.x, y: o.y, ...props(o) })).sort((a, b) => (a.id < b.id ? -1 : 1));
  const edges = t.layers.find((l) => l.name === "edges").objects.map((o) => { const p = props(o); return p.from < p.to ? [p.from, p.to] : [p.to, p.from]; }).sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
  return { nodes, edges };
}
export function check(flat) {
  const errs = []; const { nodes, edges } = flat; const idx = new Map(nodes.map((n, i) => [n.id, i])); const ok = (c, m) => { if (!c) errs.push(m); };
  ok(nodes.length >= 60 && nodes.length <= 90, `node count ${nodes.length}`); ok(new Set(edges.map((e) => e.join())).size === edges.length, "duplicate edge");
  const adj = Array.from({ length: nodes.length }, () => []); for (const [a, b] of edges) { ok(a !== b, "self loop"); ok(idx.has(a) && idx.has(b), `edge to unknown ${a} ${b}`); adj[idx.get(a)].push(idx.get(b)); adj[idx.get(b)].push(idx.get(a)); }
  const castle = nodes.findIndex((n) => n.space === "castle"); ok(nodes.filter((n) => n.space === "castle").length === 1, "exactly one castle"); ok(nodes.filter((n) => n.space === "lair").length === 1, "exactly one lair");
  const d = bfs(adj, castle); ok(d.every((x) => x >= 0), "graph not connected");
  const counts = {}; nodes.forEach((n) => (counts[n.space] = (counts[n.space] ?? 0) + 1));
  const want = { battle: 22, item: 6, loot: 4, gold: 6, town: 10, event: 8, empty: 4, shop: 4, temple: 3, shrine: 2, castle: 1, lair: 1, warp: 4 };
  for (const k of Object.keys(want)) ok(counts[k] === want[k], `space ${k}: ${counts[k]} != ${want[k]}`);
  nodes.forEach((n, i) => { ok(adj[i].length >= 2, `${n.id} degree ${adj[i].length} < 2`); ok(adj[i].length <= (n.space === "castle" ? 6 : 5), `${n.id} degree too high`); });
  const zc = {}; nodes.forEach((n) => (zc[n.zone] = (zc[n.zone] ?? 0) + 1)); ZONES.forEach((z, i) => ok(zc[z] === [15, 18, 20, 22][i], `zone ${z}: ${zc[z]}`)); // castle counts in forest
  nodes.forEach((n) => ok(n.tier === ZONES.indexOf(n.zone) + 1, `${n.id} tier/zone mismatch`));
  const towns = nodes.filter((n) => n.space === "town"); ok(towns.every((n) => n.town && n.baseValue && n.guardian), "town props"); ok(new Set(towns.map((n) => n.town)).size === 10, "town ids unique");
  towns.forEach((a) => towns.forEach((b) => { if (a.id < b.id) { const dd = bfs(adj, idx.get(a.id))[idx.get(b.id)]; ok(dd >= 2, `towns ${a.id} ${b.id} adjacent`); } }));
  const warps = nodes.filter((n) => n.space === "warp"); warps.forEach((n) => { const p = nodes[idx.get(n.warp)]; ok(p && p.warp === n.id && p.id !== n.id, `warp ${n.id} not mutual`); const dd = bfs(adj, idx.get(n.id))[idx.get(n.warp)]; ok(dd >= 6, `warp ${n.id} partner too close (${dd})`); });
  const lair = nodes.findIndex((n) => n.space === "lair"); ok(d[lair] >= 7, `lair castle distance ${d[lair]}`);
  ok(nodes[castle].zone === "enchanted-forest", "castle zone");
  // monotone tiers: mean castle distance strictly increases with tier
  const md = [1, 2, 3, 4].map((t) => { const l = nodes.filter((n, i) => n.tier === t && i !== castle); return l.reduce((s, n) => s + d[idx.get(n.id)], 0) / l.length; }); ok(md[0] < md[1] && md[1] < md[2] && md[2] < md[3], `tier mean distances not increasing ${md.map((x) => x.toFixed(2))}`);
  const temples = nodes.filter((n) => n.space === "temple"); nodes.forEach((n) => { const dd = bfs(adj, idx.get(n.id)); ok(Math.min(...temples.map((t) => dd[idx.get(t.id)])) <= 7, `${n.id} too far from a temple`); });
  return { errs, stats: { counts, md, diameter: Math.max(...nodes.map((n, i) => Math.max(...bfs(adj, i)))), edges: edges.length, avgDeg: (2 * edges.length) / nodes.length, lairDist: d[lair], adj, d, castle } };
}

if (process.argv[1].endsWith("gen-map.mjs")) {
  const arg = process.argv[2];
  if (arg === "--check") { const f = flatFromTiled(JSON.parse(readFileSync(process.argv[3], "utf8"))); const { errs } = check(f); console.log(errs.length ? errs.join("\n") : "OK"); process.exitCode = errs.length ? 1 : 0; }
  else { const m = build(); const t = toTiled(m); if (arg === "--tiled") console.log(JSON.stringify(t)); else { const { errs, stats } = check(flatFromTiled(t)); console.log(errs.length ? errs.join("\n") : "OK"); const { adj, d, castle, ...rest } = stats; console.log(JSON.stringify(rest)); } }
}
