import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rulesHash } from "@usurpia/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ReplayFileError, replayFile, RulesMismatchError } from "../src/replay-file";
import { replayRules } from "../src/rules";

const kernelFixture = fileURLToPath(new URL("../fixtures/kernel-game.json", import.meta.url));

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

describe("replayRules", () => {
  it("is the TEST_RULES copy", () => {
    expect(rulesHash(replayRules())).toBe("7433ea8b");
  });
});

describe("kernel-game fixture", () => {
  const KERNEL_LINE = "hash=9616698e rules=7433ea8b turn=1 events=10 rejections=2";

  it("replays to the golden line", () => {
    expect(replayFile(kernelFixture, replayRules()).line).toBe(KERNEL_LINE);
  });

  it("is deterministic and rejects the two scripted actions", () => {
    const first = replayFile(kernelFixture, replayRules());
    expect(replayFile(kernelFixture, replayRules()).line).toBe(first.line);
    expect(first.result.rejections.map((r) => [r.index, r.error.code])).toEqual([
      [2, "ALREADY_COMMITTED"],
      [5, "INVALID_PAYLOAD"],
    ]);
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
