import fc from "fast-check";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * For every test in the calling file, `Math.random` and `Date.now` throw, so any hidden
 * dependency of reduce/replay/serialize/viewFor on them fails the test. fast-check would
 * otherwise seed itself from both, so a seed is drawn first (with the real functions) and
 * pinned via `configureGlobal` for the duration of the test.
 */
export function usePurityTraps(): void {
  beforeEach(() => {
    const seed = (Date.now() ^ (Math.random() * 0x100000000)) | 0;
    fc.configureGlobal({ ...fc.readConfigureGlobal(), seed });
    const trap = (name: string) => () => {
      throw new Error(`core purity trap: ${name} called during a core test`);
    };
    vi.spyOn(Math, "random").mockImplementation(trap("Math.random"));
    vi.spyOn(Date, "now").mockImplementation(trap("Date.now"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    fc.resetConfigureGlobal();
  });
}
