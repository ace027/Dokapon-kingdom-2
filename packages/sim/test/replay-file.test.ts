import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rulesHash } from "@usurpia/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReplayFileError, replayFile, RulesMismatchError } from "../src/replay-file";
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
const LINE = "hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=0";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-sim-"));
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
  return { rulesHash: "7433ea8b", settings: SETTINGS, actions: [], ...overrides };
}

function errorOf(filePath: string, opts?: { allowRulesMismatch?: boolean }): unknown {
  try {
    replayFile(filePath, replayRules(), opts);
  } catch (error) {
    return error;
  }
  return undefined;
}

function runCli(...args: string[]) {
  return spawnSync(process.execPath, [tsxCli, cliPath, ...args], {
    encoding: "utf8",
    cwd: repoRoot,
  });
}

describe("replayRules", () => {
  it("is the TEST_RULES copy", () => {
    expect(rulesHash(replayRules())).toBe("7433ea8b");
  });
});

describe("replayFile", () => {
  it("prints the empty-replay line for a matching rulesHash", () => {
    expect(replayFile(writeTemp("ok.json", goodFile()), replayRules()).line).toBe(LINE);
  });

  it("is deterministic across runs", () => {
    const filePath = writeTemp("ok.json", goodFile());
    expect(replayFile(filePath, replayRules()).line).toBe(replayFile(filePath, replayRules()).line);
  });

  it("counts rejected actions instead of throwing", () => {
    const filePath = writeTemp("junk.json", goodFile({ actions: [null, { v: 2, type: "x" }] }));
    const { line, result } = replayFile(filePath, replayRules());
    expect(result.rejections.map((r) => r.error.code)).toEqual([
      "UNSUPPORTED_VERSION",
      "UNKNOWN_ACTION",
    ]);
    expect(line).toBe("hash=758ef72c rules=7433ea8b turn=1 events=0 rejections=2");
  });

  it("throws RulesMismatchError for a different rulesHash", () => {
    const error = errorOf(writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" })));
    expect(error).toBeInstanceOf(RulesMismatchError);
    expect((error as Error).message).toBe("rules mismatch: file deadbeef, current 7433ea8b");
  });

  it("proceeds with a suffix under allowRulesMismatch", () => {
    const filePath = writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" }));
    expect(replayFile(filePath, replayRules(), { allowRulesMismatch: true }).line).toBe(
      `${LINE} rules-mismatch=deadbeef`,
    );
  });
});

describe("replayFile errors", () => {
  function expectFileError(error: unknown, message: string | RegExp): void {
    expect(error).toBeInstanceOf(ReplayFileError);
    expect(error).not.toBeInstanceOf(RulesMismatchError);
    if (typeof message === "string") expect((error as Error).message).toBe(message);
    else expect((error as Error).message).toMatch(message);
  }

  it("reports invalid JSON", () => {
    expectFileError(errorOf(writeTemp("bad.json", "{ not json")), "invalid JSON");
  });

  it("reports a missing rulesHash key", () => {
    const rest = goodFile() as Record<string, unknown>;
    delete rest.rulesHash;
    expectFileError(
      errorOf(writeTemp("nohash.json", rest)),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports an extra key", () => {
    expectFileError(
      errorOf(writeTemp("extra.json", goodFile({ extra: 1 }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports actions that are not an array", () => {
    expectFileError(
      errorOf(writeTemp("actions.json", goodFile({ actions: {} }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports a rulesHash that is not 8 hex chars", () => {
    expectFileError(
      errorOf(writeTemp("badhash.json", goodFile({ rulesHash: "DEADBEEF" }))),
      "expected {rulesHash, settings, actions[]}",
    );
  });

  it("reports a non-object root", () => {
    for (const body of ["[]", "null"]) {
      expectFileError(
        errorOf(writeTemp("root.json", body)),
        "expected {rulesHash, settings, actions[]}",
      );
    }
  });

  it("reports an unreadable path", () => {
    const missing = path.join(tempDir, "does-not-exist.json");
    expectFileError(errorOf(missing), `cannot read ${missing}`);
  });

  it("reports invalid settings", () => {
    const filePath = writeTemp(
      "settings.json",
      goodFile({ settings: { ...SETTINGS, players: [] } }),
    );
    expectFileError(errorOf(filePath), /^invalid settings: /);
  });
});

describe("sim CLI", () => {
  it("prints usage and exits 2 without a file", () => {
    const result = runCli("replay");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: sim replay <file.json> [--allow-rules-mismatch]");
  });

  it("prints usage and exits 2 for an unknown command, extra arguments or an unknown flag", () => {
    const filePath = writeTemp("ok.json", goodFile());
    expect(runCli("play", filePath).status).toBe(2);
    expect(runCli("replay", filePath, "extra").status).toBe(2);
    expect(runCli("replay", filePath, "--bogus").status).toBe(2);
  });

  it("replays a valid file and prints the golden line", () => {
    const result = runCli("replay", writeTemp("ok.json", goodFile()));
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(LINE);
  });

  it("resolves a relative path against the working directory", () => {
    const filePath = writeTemp("ok.json", goodFile());
    const result = runCli("replay", path.relative(repoRoot, filePath));
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(LINE);
  });

  it("exits exactly 3 on a rules mismatch", () => {
    const result = runCli(
      "replay",
      writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" })),
    );
    expect(result.status).toBe(3);
    expect(result.stderr).toBe("error: rules mismatch: file deadbeef, current 7433ea8b\n");
    expect(result.stdout).toBe("");
  });

  it("proceeds with --allow-rules-mismatch and a suffix", () => {
    const filePath = writeTemp("mismatch.json", goodFile({ rulesHash: "deadbeef" }));
    const result = runCli("replay", filePath, "--allow-rules-mismatch");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(`${LINE} rules-mismatch=deadbeef`);
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
});
