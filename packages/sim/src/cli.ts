import path from "node:path";
import { ReplayFileError, replayFile, RulesMismatchError } from "./replay-file";
import { replayRules } from "./rules";

const USAGE = "usage: sim replay <file.json> [--allow-rules-mismatch]";
const ALLOW_FLAG = "--allow-rules-mismatch";

const [cmd, ...args] = process.argv.slice(2);
const allowRulesMismatch = args.includes(ALLOW_FLAG);
const positional = args.filter((arg) => arg !== ALLOW_FLAG);
const [file, ...extra] = positional;

if (cmd !== "replay" || file === undefined || extra.length > 0 || file.startsWith("--")) {
  console.error(USAGE);
  process.exit(2);
}

try {
  const { line } = replayFile(path.resolve(process.cwd(), file), replayRules(), {
    allowRulesMismatch,
  });
  console.log(line);
} catch (error) {
  if (error instanceof RulesMismatchError) {
    console.error(`error: ${error.message}`);
    process.exit(3);
  }
  if (error instanceof ReplayFileError) {
    console.error(`error: ${error.message}`);
    process.exit(2);
  }
  throw error;
}
