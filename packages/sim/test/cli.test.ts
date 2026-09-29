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
    { id: "p1", classId: "fighter" },
    { id: "p2", classId: "caster" },
  ],
};
// Derived from the current rules, so these tests survive the W3 rules switch unchanged.
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

  it("prints usage and exits 2 with no command at all", () => {
    const result = runCli();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: sim replay");
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

  it("replays the committed kernel fixture through the CLI", () => {
    const result = runCli("replay", "packages/sim/fixtures/kernel-game.json");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(
      `hash=9616698e rules=${RULES_HASH} turn=1 events=10 rejections=2`,
    );
  });
});
