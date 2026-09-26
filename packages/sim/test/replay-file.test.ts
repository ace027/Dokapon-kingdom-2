import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReplayFileError, replayFile } from "../src/index";

const fixturePath = fileURLToPath(new URL("../fixtures/sample-game.json", import.meta.url));
const cliPath = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

const LINE = /^hash=[0-9a-f]{8} turn=3 counter=3 events=10 rejections=1$/;

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [tsxCli, cliPath, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
  });
}

describe("replayFile on the sample fixture", () => {
  it("prints the expected summary line", () => {
    expect(replayFile(fixturePath).line).toMatch(LINE);
  });

  it("is deterministic across runs", () => {
    expect(replayFile(fixturePath).line).toBe(replayFile(fixturePath).line);
  });

  it("rejects the out-of-turn roll and resolves the timed-out decision", () => {
    const { result } = replayFile(fixturePath);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.index).toBe(2);
    expect(result.rejections[0]?.error.code).toBe("WRONG_ACTOR");
    expect(result.events.map((event) => event.type)).toEqual([
      "Rolled",
      "TurnAdvanced",
      "CounterIncremented",
      "Rolled",
      "TurnAdvanced",
      "SecretSet",
      "DecisionOpened",
      "ChoiceCommitted",
      "ChoiceTimedOut",
      "ChoicesRevealed",
    ]);
    expect(result.state.public.lastReveal).toEqual({
      decisionId: "d1",
      choices: { p1: "B", p2: "A" },
      timedOut: ["p2"],
    });
  });
});

describe("replayFile errors", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-sim-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeTemp(name: string, contents: string): string {
    const filePath = path.join(tempDir, name);
    fs.writeFileSync(filePath, contents);
    return filePath;
  }

  function errorOf(filePath: string): unknown {
    try {
      replayFile(filePath);
    } catch (error) {
      return error;
    }
    return undefined;
  }

  it("reports invalid JSON", () => {
    const error = errorOf(writeTemp("bad.json", "{ not json"));
    expect(error).toBeInstanceOf(ReplayFileError);
    expect((error as Error).message).toBe("invalid JSON");
  });

  it("reports a missing actions array", () => {
    const settings = { v: 1, seed: "s", players: ["p1"] };
    for (const body of [{ settings }, { settings, actions: {} }, [], null]) {
      const error = errorOf(writeTemp("shape.json", JSON.stringify(body)));
      expect(error).toBeInstanceOf(ReplayFileError);
      expect((error as Error).message).toBe("expected {settings, actions[]}");
    }
  });

  it("reports an unreadable path", () => {
    const missing = path.join(tempDir, "does-not-exist.json");
    const error = errorOf(missing);
    expect(error).toBeInstanceOf(ReplayFileError);
    expect((error as Error).message).toBe(`cannot read ${missing}`);
  });

  it("reports invalid settings", () => {
    const filePath = writeTemp(
      "settings.json",
      JSON.stringify({ settings: { v: 1, seed: "s", players: [] }, actions: [] }),
    );
    const error = errorOf(filePath);
    expect(error).toBeInstanceOf(ReplayFileError);
    expect((error as Error).message).toMatch(/^invalid settings: /);
  });
});

describe("sim CLI", () => {
  it("prints usage and exits 2 without a file", () => {
    const result = runCli("replay");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: sim replay <file.json>");
  });

  it("prints usage and exits 2 for an unknown command or extra arguments", () => {
    expect(runCli("play", fixturePath).status).toBe(2);
    expect(runCli("replay", fixturePath, "extra").status).toBe(2);
  });

  it("replays the fixture from the repo root with a relative path", () => {
    const result = runCli("replay", "packages/sim/fixtures/sample-game.json");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(LINE);
  });

  it("prints an error and exits 2 for a missing file", () => {
    const result = runCli("replay", "packages/sim/fixtures/nope.json");
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^error: cannot read /);
  });
});
