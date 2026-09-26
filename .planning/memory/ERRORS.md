# Pitfalls

Project-specific pitfalls recorded via `/legion:learn`.
Referenced by `/legion:plan` and `/legion:build` for context-aware execution.

## PIT-001: Negative tests that pass because an earlier check fails first
- **Date**: 2026-09-26
- **Type**: pitfall
- **Tags**: testing, mutation, deserialize, validation
- **Phase**: Phase 1 (review)

Validation-table tests for `deserialize` passed three times across review cycles 2–3 only because an earlier check rejected the fixture. Examples: "bad phase" on a state whose `pending` was null, "required empty" with `committed` still set, and "duplicate committed" with a choices-length mismatch. For each negative test, build the fixture so that exactly one check can reject it, and prove this by deleting that check and seeing only that test fail.

---

## PIT-002: Plain objects keyed by player ids hit Object.prototype members
- **Date**: 2026-09-26
- **Type**: pitfall
- **Tags**: core, security, records, player-id
- **Phase**: Phase 1 (review)

`choices[p] ?? fallback` returned the inherited `toString` function for a player named "toString", which put a function into the game state. Always use `Object.hasOwn` or `ownGet` for records keyed by user-controlled ids, and include `toString`/`valueOf`/`hasOwnProperty` in the property-test id pools.

---
