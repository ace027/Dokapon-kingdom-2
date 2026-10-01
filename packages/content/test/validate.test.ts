import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildRules, validateContent } from "../src/index";
import type { ContentEntry, ContentError } from "../src/index";
import { loadContentDir } from "../src/node";
import { cleanupTemp, copyDataToTemp, DATA_DIR, loadEntries, setPath } from "./helpers";

const base = loadEntries();

const corrupt = (root: Record<string, unknown>): void => {
  root.v = 2;
};

describe("validateContent", () => {
  it("returns no errors for the shipped content", () => {
    expect(validateContent(base)).toEqual([]);
  });

  it.each<[string, ContentEntry[]]>([
    ["a schema error", setPath(base, "items.json", "items.0.price", -1)],
    ["a duplicate id", setPath(base, "gear.json", "gear.1.id", "wooden-sword")],
    ["a cross-reference error", setPath(base, "monsters.json", "monsters.0.zone", "nowhere")],
  ])("shares one code path with buildRules for %s", (_label, entries) => {
    const result = buildRules(entries);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(validateContent(entries)).toEqual(result.errors);
  });

  it("reports a missing required file", () => {
    expect(validateContent(base.filter((e) => e.file !== "tuning.json"))).toEqual([
      { file: "tuning.json", path: "", message: "missing required content file" },
    ]);
  });

  it("reports every missing file for an empty entry list, sorted", () => {
    expect(validateContent([]).map((e) => e.file)).toEqual([
      "classes.json",
      "gear.json",
      "items.json",
      "monsters.json",
      "spells.json",
      "tuning.json",
    ]);
  });

  it("reports an unknown file", () => {
    expect(validateContent([...base, { file: "extra.json", data: {} }])).toEqual([
      { file: "extra.json", path: "", message: "unknown content file (not in CONTENT_REGISTRY)" },
    ]);
  });

  it("reports invalid JSON (data undefined) without crashing", () => {
    const entries = base.map((e) =>
      e.file === "gear.json" ? { file: e.file, data: undefined } : e,
    );
    expect(validateContent(entries)).toEqual([
      { file: "gear.json", path: "", message: "invalid JSON" },
    ]);
  });

  it("sorts errors by file, then path, regardless of input order", () => {
    const broken = setPath(
      setPath(setPath(base, "items.json", "items.0.price", -1), "items.json", "items.0.name", ""),
      "classes.json",
      "classes.0.bagSize",
      99,
    );
    const expected = [
      { file: "classes.json", path: "classes.0.bagSize" },
      { file: "items.json", path: "items.0.name" },
      { file: "items.json", path: "items.0.price" },
    ];
    const locations = (entries: ContentEntry[]): { file: string; path: string }[] =>
      validateContent(entries).map(({ file, path: p }: ContentError) => ({ file, path: p }));
    expect(locations(broken)).toEqual(expected);
    expect(locations([...broken].reverse())).toEqual(expected);
  });
});

describe("loadContentDir", () => {
  let tempDir: string | undefined;
  afterEach(() => {
    cleanupTemp(tempDir);
    tempDir = undefined;
  });

  it("loads the shipped data dir (6 files, sorted) by URL or path", () => {
    const files = loadContentDir(DATA_DIR).map((e) => e.file);
    expect(files).toEqual([
      "classes.json",
      "gear.json",
      "items.json",
      "monsters.json",
      "spells.json",
      "tuning.json",
    ]);
    expect(loadContentDir(fileURLToPath(DATA_DIR)).map((e) => e.file)).toEqual(files);
  });

  it("returns data undefined for broken JSON and only reads *.json", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-content-"));
    fs.writeFileSync(path.join(tempDir, "broken.json"), "{");
    fs.writeFileSync(path.join(tempDir, "a.json"), "{}");
    fs.writeFileSync(path.join(tempDir, "notes.txt"), "ignored");
    expect(loadContentDir(tempDir)).toEqual([
      { file: "a.json", data: {} },
      { file: "broken.json", data: undefined },
    ]);
  });

  it("throws for a missing dir", () => {
    const missing = path.join(os.tmpdir(), "usurpia-does-not-exist-9f3c");
    expect(() => loadContentDir(missing)).toThrow(`content dir not found: ${missing}`);
  });
});

describe("validate CLI (subprocess)", () => {
  const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const scriptPath = fileURLToPath(new URL("../scripts/validate.ts", import.meta.url));
  let tempDir: string | undefined;
  afterEach(() => {
    cleanupTemp(tempDir);
    tempDir = undefined;
  });

  const runCli = (...args: string[]) =>
    spawnSync(process.execPath, [tsxCli, scriptPath, ...args], { encoding: "utf8", cwd: repoRoot });

  it("exits 0 on a valid copy of the data", () => {
    tempDir = copyDataToTemp();
    const result = runCli("--dir", tempDir);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ content valid (6 files)");
  });

  it("exits exactly 1 on a copy with one corrupted file, with located errors", () => {
    tempDir = copyDataToTemp({ file: "items.json", mutate: corrupt });
    const result = runCli("--dir", tempDir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("✗ items.json v:");
  });

  it("exits 0 on the shipped data dir (default)", () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ content valid (6 files)");
  });

  it("exits 2 with usage on an unknown argument", () => {
    const result = runCli("--bogus");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("usage: validate [--dir <path>]");
  });

  it("exits 2 when the dir does not exist", () => {
    const result = runCli("--dir", path.join(os.tmpdir(), "usurpia-does-not-exist-9f3c"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("error: content dir not found:");
  });

  it("honours USURPIA_CONTENT_DIR, with --dir taking precedence", () => {
    tempDir = copyDataToTemp({ file: "items.json", mutate: corrupt });
    const env = { ...process.env, USURPIA_CONTENT_DIR: tempDir };
    const viaEnv = spawnSync(process.execPath, [tsxCli, scriptPath], {
      encoding: "utf8",
      cwd: repoRoot,
      env,
    });
    expect(viaEnv.status).toBe(1);
    const dirWins = spawnSync(
      process.execPath,
      [tsxCli, scriptPath, "--dir", fileURLToPath(DATA_DIR)],
      { encoding: "utf8", cwd: repoRoot, env },
    );
    expect(dirWins.status).toBe(0);
  });
});

describe("content build script (the real `pnpm build` gate)", () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
  let tempDir: string | undefined;
  afterEach(() => {
    cleanupTemp(tempDir);
    tempDir = undefined;
  });

  it("wires scripts.build to scripts/validate.ts and exports ./node and ./shipped", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      scripts?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(manifest.scripts?.build).toMatch(/(^|\s)tsx scripts\/validate\.ts(\s|$)/);
    expect(manifest.exports).toEqual({
      ".": "./src/index.ts",
      "./node": "./src/node.ts",
      "./shipped": "./src/shipped.ts",
    });
  });

  function runBuild(env: NodeJS.ProcessEnv) {
    return spawnSync("pnpm", ["--filter", "@usurpia/content", "run", "build"], {
      encoding: "utf8",
      cwd: repoRoot,
      env,
    });
  }

  it("fails (exit exactly 1) when pointed at a corrupted copy", () => {
    tempDir = copyDataToTemp({ file: "items.json", mutate: corrupt });
    const result = runBuild({ ...process.env, USURPIA_CONTENT_DIR: tempDir });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("✗ items.json v:");
  });

  it("passes (exit 0) on the shipped data", () => {
    const env = { ...process.env };
    delete env.USURPIA_CONTENT_DIR;
    const result = runBuild(env);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ content valid");
  });
});
