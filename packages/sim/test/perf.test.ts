// Performance budget (spec: critique #12): 10 000 duels through the real CLI within the 60 s CI
// budget, with the pinned total line (outcomes only, so it is reward-independent).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const WALL_BUDGET_MS = 60_000;

describe("sim perf", { timeout: 180_000 }, () => {
  it("runs 10 000 duels within the budget and prints the pinned total", () => {
    const started = performance.now();
    const result = spawnSync("pnpm", ["sim", "duel", "--n", "10000", "--seed", "perf"], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const wallMs = performance.now() - started;
    expect(result.status).toBe(0);
    expect(wallMs).toBeLessThanOrEqual(WALL_BUDGET_MS);
    expect(result.stdout).toContain("# class-vs-class");
    expect(result.stdout).toContain("# class-vs-monster");
    const lines = result.stdout.split("\n").filter((line) => line.trim() !== "");
    expect(lines.at(-1)).toBe("total n=10000 a=5411 b=2370 draw=2118 fled=101");
  });
});
