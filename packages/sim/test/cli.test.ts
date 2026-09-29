import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rulesHash } from "@usurpia/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replayRules } from "../src/rules";

const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

const SETTINGS = {
  v: 2,
  seed: "fixture",
  players: [
    { id: "a", classId: "warrior" },
    { id: "b", classId: "mage" },
  ],
};
const RULES_HASH = rulesHash(replayRules());
const EMPTY_LINE = `hash=[0-9a-f]{8} rules=${RULES_HASH} turn=1 events=0 rejections=0`;

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-cli-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function writeTemp(name: string, contents: unknown): string {
  const filePath = path.join(tempDir, name);
  fs.writeFileSync(filePath, typeof contents === "string" ? contents : JSON.stringify(contents));
  return filePath;
}

function goodFile(overrides: Record<string, unknown> = {}): unknown {
  return { rulesHash: RULES_HASH, settings: SETTINGS, actions: [], ...overrides };
}

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [tsxCli, cliPath, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
  });
}

describe("sim CLI", () => {
  it("prints usage and exits 2 without a file", () => {
    const result = runCli("replay");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: sim replay <file.json> [--allow-rules-mismatch]");
  });

  it("prints usage for both commands and exits 2 with no command at all", () => {
    const result = runCli();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: sim replay");
    expect(result.stderr).toContain("usage: sim duel");
  });

  it("exits 2 for an unknown command", () => {
    expect(runCli("play", writeTemp("ok.json", goodFile())).status).toBe(2);
  });

  it("exits 2 for an extra positional argument", () => {
    expect(runCli("replay", writeTemp("ok.json", goodFile()), "extra").status).toBe(2);
  });

  it("exits 2 for an unknown flag", () => {
    expect(runCli("replay", writeTemp("ok.json", goodFile()), "--bogus").status).toBe(2);
  });

  it("replays a valid file and prints the line with the current rulesHash", () => {
    const result = runCli("replay", writeTemp("ok.json", goodFile()));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(new RegExp(`^${EMPTY_LINE}$`));
  });

  it("resolves a relative path against the working directory", () => {
    const filePath = writeTemp("ok.json", goodFile());
    const result = runCli("replay", path.relative(repoRoot, filePath));
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(new RegExp(`^${EMPTY_LINE}$`));
  });

  it("exits exactly 3 on a rules mismatch", () => {
    const result = runCli(
      "replay",
      writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" })),
    );
    expect(result.status).toBe(3);
    expect(result.stderr).toBe(`error: rules mismatch: file deadbeef, current ${RULES_HASH}\n`);
    expect(result.stdout).toBe("");
  });

  it("exits 3 for a file recorded with the old kernel rules (7433ea8b)", () => {
    const result = runCli("replay", writeTemp("kernel.json", goodFile({ rulesHash: "7433ea8b" })));
    expect(result.status).toBe(3);
    expect(result.stderr).toBe("error: rules mismatch: file 7433ea8b, current 84a995db\n");
  });

  it("proceeds with --allow-rules-mismatch and prints the mismatch suffix", () => {
    const filePath = writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" }));
    const result = runCli("replay", filePath, "--allow-rules-mismatch");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(new RegExp(`^${EMPTY_LINE} rules-mismatch=deadbeef$`));
  });

  it("exits 2 for invalid JSON", () => {
    const result = runCli("replay", writeTemp("bad.json", "{ not json"));
    expect(result.status).toBe(2);
    expect(result.stderr).toBe("error: invalid JSON\n");
  });

  it("exits 2 for a file with a missing rulesHash", () => {
    const result = runCli("replay", writeTemp("nohash.json", { settings: SETTINGS, actions: [] }));
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^error: expected \{rulesHash, settings, actions\[\]\}/);
  });

  it("prints an error and exits 2 for a missing file", () => {
    const result = runCli("replay", path.join(tempDir, "nope.json"));
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^error: cannot read /);
  });

  it("replays the committed combat fixture through the CLI", () => {
    const result = runCli("replay", "packages/sim/fixtures/combat-game.json");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("hash=0483c0fa rules=84a995db turn=1 events=95 rejections=0\n");
  });
});

describe("sim CLI duel usage errors", () => {
  const BAD: [string, string[]][] = [
    ["--n 0", ["--n", "0"]],
    ["--n x", ["--n", "x"]],
    ["--n -3", ["--n", "-3"]],
    ["--n 1.5", ["--n", "1.5"]],
    ["--n 1e3", ["--n", "1e3"]],
    ["--n 0x10", ["--n", "0x10"]],
    ["--n without a value", ["--n"]],
    ["--n followed by a flag", ["--n", "--json"]],
    ["--level 0", ["--level", "0"]],
    ["--level 21", ["--level", "21"]],
    ["--level x", ["--level", "x"]],
    ["--difficulty insane", ["--difficulty", "insane"]],
    ["--difficulty hard:", ["--difficulty", "hard:"]],
    ["--difficulty :easy", ["--difficulty", ":easy"]],
    ["--difficulty hard:easy:normal", ["--difficulty", "hard:easy:normal"]],
    ["--matchup wizard:mage", ["--matchup", "wizard:mage"]],
    ["--matchup warrior:monster/nope", ["--matchup", "warrior:monster/nope"]],
    ["--matchup without a value", ["--matchup"]],
    ["--seed without a value", ["--seed"]],
    ["--seed followed by a flag", ["--seed", "--json"]],
    ["--matchup with three parts", ["--matchup", "warrior:mage:thief"]],
    ["--bogus", ["--bogus"]],
    ["a stray positional", ["extra"]],
  ];
  for (const [name, args] of BAD) {
    it(`exits 2 with a usage line for ${name}`, () => {
      const result = runCli("duel", ...args);
      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/^usage: /);
      expect(result.stdout).toBe("");
    });
  }

  it("accepts every valid flag together", () => {
    const result = runCli(
      "duel",
      "--n",
      "3",
      "--matchup",
      "warrior:mage",
      "--difficulty",
      "easy:hard",
      "--seed",
      "s",
      "--level",
      "20",
      "--json",
    );
    expect(result.status).toBe(0);
  });

  it("accepts a single difficulty for both sides", () => {
    const result = runCli("duel", "--n", "2", "--matchup", "mirrors", "--difficulty", "hard");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("difficulty=hard:hard");
  });
});
