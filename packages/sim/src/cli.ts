import path from "node:path";
import { ContentInvalidError } from "@usurpia/content/node";
import type { Rules } from "@usurpia/core";
import type { Difficulty } from "@usurpia/core/ai";
import { UsageError } from "./duel";
import { ReplayFileError, replayFile, RulesMismatchError } from "./replay-file";
import { runReport } from "./report";
import { replayRules } from "./rules";

const EXIT_INVALID_CONTENT = 1;
const REPLAY_USAGE = "usage: sim replay <file.json> [--allow-rules-mismatch]";
const DUEL_USAGE =
  "usage: sim duel [--n <int>] [--matchup <spec>] [--difficulty <d>|<dA>:<dB>] [--seed <s>] [--level <int>] [--json]";
const ALLOW_FLAG = "--allow-rules-mismatch";
const DIFFICULTIES: readonly string[] = ["easy", "normal", "hard"];
const VALUE_FLAGS = ["--n", "--matchup", "--difficulty", "--seed", "--level"] as const;

function isDifficulty(value: string): value is Difficulty {
  return DIFFICULTIES.includes(value);
}

/** Loads the shipped (or `USURPIA_CONTENT_DIR`) rules; invalid content prints its error lines. */
function loadRulesOrReport(): Rules | number {
  try {
    return replayRules();
  } catch (error) {
    if (error instanceof ContentInvalidError) {
      console.error(error.message);
      return EXIT_INVALID_CONTENT;
    }
    throw error;
  }
}

function parseDifficulty(text: string): [Difficulty, Difficulty] {
  const parts = text.split(":");
  const [first, second] = parts;
  if (parts.length > 2 || first === undefined || !isDifficulty(first)) {
    throw new UsageError(`bad difficulty "${text}"`);
  }
  if (second === undefined) return [first, first];
  if (!isDifficulty(second)) throw new UsageError(`bad difficulty "${text}"`);
  return [first, second];
}

function parseInteger(flag: string, text: string, min: number, max: number): number {
  const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new UsageError(`${flag} must be an integer in ${String(min)}..${String(max)}`);
  }
  return value;
}

function runReplay(args: readonly string[]): number {
  const allowRulesMismatch = args.includes(ALLOW_FLAG);
  const positional = args.filter((arg) => arg !== ALLOW_FLAG);
  const [file, ...extra] = positional;
  if (file === undefined || extra.length > 0 || file.startsWith("--")) {
    console.error(REPLAY_USAGE);
    return 2;
  }
  const rules = loadRulesOrReport();
  if (typeof rules === "number") return rules;
  try {
    const { line } = replayFile(path.resolve(process.cwd(), file), rules, {
      allowRulesMismatch,
    });
    console.log(line);
    return 0;
  } catch (error) {
    if (error instanceof RulesMismatchError) {
      console.error(`error: ${error.message}`);
      return 3;
    }
    if (error instanceof ReplayFileError) {
      console.error(`error: ${error.message}`);
      return 2;
    }
    throw error;
  }
}

function parseDuelArgs(args: readonly string[]): {
  values: Map<string, string>;
  json: boolean;
} {
  const values = new Map<string, string>();
  let json = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      json = true;
    } else if (arg !== undefined && (VALUE_FLAGS as readonly string[]).includes(arg)) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError(`${arg} needs a value`);
      }
      values.set(arg, value);
      i += 1;
    } else {
      throw new UsageError(`unknown argument "${arg ?? ""}"`);
    }
  }
  return { values, json };
}

function runDuelCommand(args: readonly string[]): number {
  const rules = loadRulesOrReport();
  if (typeof rules === "number") return rules;
  try {
    const { values, json } = parseDuelArgs(args);
    const n = parseInteger("--n", values.get("--n") ?? "1000", 1, Number.MAX_SAFE_INTEGER);
    const level = parseInteger(
      "--level",
      values.get("--level") ?? "5",
      1,
      rules.progression.maxLevel,
    );
    const difficulty = parseDifficulty(values.get("--difficulty") ?? "normal");
    const started = performance.now();
    const report = runReport(rules, {
      n,
      matchup: values.get("--matchup") ?? "all",
      difficulty,
      seed: values.get("--seed") ?? "usurpia",
      level,
    });
    console.log(json ? report.json : report.text);
    console.error(`elapsed_ms=${String(Math.round(performance.now() - started))}`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`usage: ${error.message}`);
      console.error(DUEL_USAGE);
      return 2;
    }
    throw error;
  }
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "replay") {
  process.exitCode = runReplay(args);
} else if (cmd === "duel") {
  process.exitCode = runDuelCommand(args);
} else {
  console.error(REPLAY_USAGE);
  console.error(DUEL_USAGE);
  process.exitCode = 2;
}
