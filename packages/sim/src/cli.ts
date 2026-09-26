import path from "node:path";
import { ReplayFileError, replayFile } from "./replay-file";

const USAGE = "usage: sim replay <file.json>";

const [cmd, file, ...rest] = process.argv.slice(2);

if (cmd !== "replay" || file === undefined || rest.length > 0) {
  console.error(USAGE);
  process.exit(2);
}

try {
  const { line } = replayFile(path.resolve(process.cwd(), file));
  console.log(line);
} catch (error) {
  if (error instanceof ReplayFileError) {
    console.error(`error: ${error.message}`);
    process.exit(2);
  }
  throw error;
}
