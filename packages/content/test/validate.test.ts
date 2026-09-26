import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { validateContent, type ContentEntry, type ContentError } from "../src/index";
import { loadContentDir } from "../src/load";

const validItem = {
  id: "herb",
  name: "Herb",
  kind: "consumable",
  price: 20,
  description: "Heals 30% HP.",
};

function itemsEntry(items: unknown[], v: unknown = 1): ContentEntry {
  return { file: "items.json", data: { v, items } };
}

function withItem(overrides: Record<string, unknown>): ContentEntry {
  return itemsEntry([{ ...validItem, ...overrides }]);
}

function locations(errors: readonly ContentError[]): { file: string; path: string }[] {
  return errors.map(({ file, path: errorPath }) => ({ file, path: errorPath }));
}

const fixturesDir = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url));

describe("validateContent", () => {
  it("returns no errors for valid entries", () => {
    expect(validateContent([itemsEntry([validItem, { ...validItem, id: "big-herb" }])])).toEqual(
      [],
    );
  });

  it.each([
    ["an uppercase / spaced id", { id: "Bad Id" }, "items.0.id"],
    ["an id starting with a digit", { id: "1herb" }, "items.0.id"],
    ["an empty name", { name: "" }, "items.0.name"],
    ["a name longer than 40 chars", { name: "x".repeat(41) }, "items.0.name"],
    ["an unknown kind", { kind: "weapon" }, "items.0.kind"],
    ["a negative price", { price: -1 }, "items.0.price"],
    ["a fractional price", { price: 1.5 }, "items.0.price"],
    ["an empty description", { description: "" }, "items.0.description"],
  ])("rejects %s", (_label, overrides, expectedPath) => {
    expect(locations(validateContent([withItem(overrides)]))).toEqual([
      { file: "items.json", path: expectedPath },
    ]);
  });

  it("accepts a 40-char name and a zero price (boundaries)", () => {
    expect(validateContent([withItem({ name: "x".repeat(40), price: 0 })])).toEqual([]);
  });

  it("reports an unknown key as one unrecognized_keys issue at the object's path", () => {
    const errors = validateContent([withItem({ extra: true })]);
    expect(locations(errors)).toEqual([{ file: "items.json", path: "items.0" }]);
    expect(errors[0]?.message).toContain("extra");
  });

  it("rejects an unknown top-level key", () => {
    const errors = validateContent([
      { file: "items.json", data: { v: 1, items: [validItem], x: 1 } },
    ]);
    expect(locations(errors)).toEqual([{ file: "items.json", path: "" }]);
  });

  it("rejects an empty items array", () => {
    expect(locations(validateContent([itemsEntry([])]))).toEqual([
      { file: "items.json", path: "items" },
    ]);
  });

  it("rejects a bare array instead of the file object", () => {
    expect(locations(validateContent([{ file: "items.json", data: [] }]))).toEqual([
      { file: "items.json", path: "" },
    ]);
  });

  it("rejects an unsupported file version", () => {
    expect(locations(validateContent([itemsEntry([validItem], 2)]))).toEqual([
      { file: "items.json", path: "v" },
    ]);
  });

  it("reports duplicate ids at the later occurrence", () => {
    const errors = validateContent([
      itemsEntry([validItem, { ...validItem, id: "big-herb" }, { ...validItem }]),
    ]);
    expect(errors).toEqual([
      { file: "items.json", path: "items.2.id", message: 'duplicate id "herb" (first at items.0)' },
    ]);
  });

  it("reports an unknown content file", () => {
    const errors = validateContent([itemsEntry([validItem]), { file: "monsters.json", data: {} }]);
    expect(errors).toEqual([
      {
        file: "monsters.json",
        path: "",
        message: "unknown content file (not in CONTENT_REGISTRY)",
      },
    ]);
  });

  it("does not treat Object.prototype keys as registered files", () => {
    const errors = validateContent([itemsEntry([validItem]), { file: "constructor", data: {} }]);
    expect(locations(errors)).toEqual([{ file: "constructor", path: "" }]);
  });

  it("reports a missing registered file", () => {
    expect(validateContent([])).toEqual([
      { file: "items.json", path: "", message: "missing required content file" },
    ]);
  });

  it("reports invalid JSON (data undefined) without crashing", () => {
    expect(validateContent([{ file: "items.json", data: undefined }])).toEqual([
      { file: "items.json", path: "", message: "invalid JSON" },
    ]);
  });

  it("sorts errors by file, then path, regardless of input order", () => {
    const entries: ContentEntry[] = [
      { file: "zeta.json", data: {} },
      itemsEntry([{ ...validItem, price: -1, name: "", id: "Bad" }]),
      { file: "alpha.json", data: {} },
    ];
    const expected = [
      { file: "alpha.json", path: "" },
      { file: "items.json", path: "items.0.id" },
      { file: "items.json", path: "items.0.name" },
      { file: "items.json", path: "items.0.price" },
      { file: "zeta.json", path: "" },
    ];
    expect(locations(validateContent(entries))).toEqual(expected);
    expect(locations(validateContent([...entries].reverse()))).toEqual(expected);
  });
});

describe("loadContentDir", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir !== undefined) fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it("loads the valid fixture dir with parsed data", () => {
    const entries = loadContentDir(fixturesDir("valid"));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.file).toBe("items.json");
    expect(entries[0]?.data).toMatchObject({
      v: 1,
      items: [{ id: "herb" }, { id: "rubber-chicken" }],
    });
    expect(validateContent(entries)).toEqual([]);
  });

  it("accepts a URL", () => {
    const entries = loadContentDir(new URL("./fixtures/valid/", import.meta.url));
    expect(entries.map((e) => e.file)).toEqual(["items.json"]);
  });

  it("returns data undefined for broken JSON, only reads *.json, and sorts by name", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-"));
    fs.writeFileSync(path.join(tempDir, "broken.json"), "{");
    fs.writeFileSync(path.join(tempDir, "a.json"), "{}");
    fs.writeFileSync(path.join(tempDir, "notes.txt"), "ignored");
    const entries = loadContentDir(tempDir);
    expect(entries).toEqual([
      { file: "a.json", data: {} },
      { file: "broken.json", data: undefined },
    ]);
    expect(validateContent(entries)).toContainEqual({
      file: "broken.json",
      path: "",
      message: "unknown content file (not in CONTENT_REGISTRY)",
    });
  });

  it("reports missing items.json for an empty data dir", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "usurpia-"));
    expect(validateContent(loadContentDir(tempDir))).toEqual([
      { file: "items.json", path: "", message: "missing required content file" },
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

  const runCli = (...args: string[]) =>
    spawnSync(process.execPath, [tsxCli, scriptPath, ...args], { encoding: "utf8", cwd: repoRoot });

  it("exits 0 on the valid fixture dir", () => {
    const result = runCli("--dir", fixturesDir("valid"));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ content valid (1 files)");
  });

  it("exits 1 on the invalid fixture dir (fixtures/invalid) with located errors", () => {
    const result = runCli("--dir", fixturesDir("invalid"));
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("✗ items.json");
    expect(result.stdout).toContain("✗ items.json items.0.id:");
    expect(result.stdout).toContain("✗ items.json items.2.price:");
  });

  it("exits 0 on the shipped data dir (default)", () => {
    const result = runCli();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("✓ content valid");
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
});
