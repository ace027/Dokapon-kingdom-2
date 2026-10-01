import { z } from "zod";
import {
  BOARD_HOOKS,
  COMBAT_HOOKS,
  COMMANDS,
  CONTENT_ID_PATTERN,
  RESERVED_CONTENT_IDS,
  STAT_KEYS,
  type HookName,
} from "@usurpia/core";

/** Shared limits (spec: `@usurpia/content` → Ranges). */
export const MAX_PRICE = 1_000_000;
export const MAX_BP = 100_000;

export const IdSchema = z
  .string()
  .regex(CONTENT_ID_PATTERN, "id must be kebab-case, start with a letter, max 48 chars")
  .refine((id) => !RESERVED_CONTENT_IDS.includes(id), "reserved id");

export const IntSchema = (min: number, max: number) => z.number().int().min(min).max(max);

/** All six stat keys are required; every value is an int in [min, max]. */
export const statShape = (min: number, max: number) =>
  Object.fromEntries(STAT_KEYS.map((key) => [key, IntSchema(min, max)])) as Record<
    (typeof STAT_KEYS)[number],
    ReturnType<typeof IntSchema>
  >;
export const StatBlockSchema = (min: number, max: number) => z.strictObject(statShape(min, max));

const BP = 10_000;
const NO_LOWER = -BP; // a hook may cut a stat or damage to 0 (x0), never below
const OPEN_TOP = 100_000;

/**
 * Allowed `value` range per hook (bp unless noted), from what the engine does with the summed
 * value. Typed by `HookName`, so a new hook name fails typecheck until it gets a range.
 * - sheet-stat, damage and "taken" hooks are multipliers `(10000 + v) / 10000`: -10000 (x0) up to x11.
 * - fractions of a quantity (guard, reflect, lifesteal, regen, steal) are 0..10000: more than 100%
 *   would heal beyond the damage dealt, reflect more than was cast, or steal more gold than held.
 * - crit / flee chance deltas are in chance bp (10000 = certain).
 * - `poisonOnHit` / `stealItemOnHit` are flags (only `> 0` is read).
 * - board hooks are not applied in Phase 2; fraction-like ones get 0..10000, the rest a loose range.
 */
export const HOOK_RANGES: Readonly<Record<HookName, readonly [min: number, max: number]>> = {
  hpBp: [NO_LOWER, OPEN_TOP],
  atkBp: [NO_LOWER, OPEN_TOP],
  defBp: [NO_LOWER, OPEN_TOP],
  magBp: [NO_LOWER, OPEN_TOP],
  spdBp: [NO_LOWER, OPEN_TOP],
  luckBp: [NO_LOWER, OPEN_TOP],
  attackDmgBp: [NO_LOWER, OPEN_TOP],
  strikeDmgBp: [NO_LOWER, OPEN_TOP],
  spellDmgBp: [NO_LOWER, OPEN_TOP],
  guardVsStrikeBp: [0, BP],
  counterDmgBp: [NO_LOWER, OPEN_TOP],
  wardReflectBp: [0, BP],
  critBp: [-BP, BP],
  fleeBp: [-BP, BP],
  lifestealBp: [0, BP],
  roundRegenBp: [0, BP],
  spellTakenBp: [NO_LOWER, OPEN_TOP],
  physTakenBp: [NO_LOWER, OPEN_TOP],
  spellbladeStrike: [0, OPEN_TOP],
  poisonOnHit: [0, 1],
  stealGoldOnHitBp: [0, BP],
  stealItemOnHit: [0, 1],
  pvpExtraSteal: [0, OPEN_TOP],
  passPickpocketBp: [0, BP],
  spellPriceBp: [-BP, BP],
  fieldSpellMove: [0, OPEN_TOP],
  turnRegenBp: [0, BP],
  townTaxBp: [0, BP],
  crownTaxResistBp: [0, BP],
  lootLuckBp: [NO_LOWER, OPEN_TOP],
};

export const hookShape = {
  hook: z.enum([...COMBAT_HOOKS, ...BOARD_HOOKS]),
  value: z.number().int(),
};

/** Per-hook range check on `value` (error path `<hook>.value`). Apply to every object with `hookShape`. */
export function checkHookRange(
  entry: { readonly hook: HookName; readonly value: number },
  ctx: z.core.$RefinementCtx,
): void {
  const [min, max] = HOOK_RANGES[entry.hook];
  if (entry.value < min || entry.value > max) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: `${entry.hook} value must be between ${String(min)} and ${String(max)}`,
    });
  }
}

export const HookSchema = z.strictObject(hookShape).superRefine(checkHookRange);

export const CommandWeightsSchema = z.strictObject(
  Object.fromEntries(COMMANDS.map((command) => [command, IntSchema(0, 100)])) as Record<
    (typeof COMMANDS)[number],
    ReturnType<typeof IntSchema>
  >,
);

export const AttackTableSchema = z.strictObject({
  attack: IntSchema(0, 1000),
  strike: IntSchema(0, 1000),
  spell: IntSchema(0, 1000),
  flee: IntSchema(0, 1000),
});

export const DefendTableSchema = z.strictObject({
  guard: IntSchema(0, 1000),
  counter: IntSchema(0, 1000),
  ward: IntSchema(0, 1000),
});

export const LoadoutSchema = z.strictObject({
  weapon: IdSchema.nullable(),
  shield: IdSchema.nullable(),
  accessory: IdSchema.nullable(),
  battleSpell: IdSchema.nullable(),
  wardSpell: IdSchema.nullable(),
  bag: z.array(IdSchema),
});

/** Literal unions (not `number`) so the parsed output is assignable to `Rules` without a cast. */
export const TierSchema = z.literal([1, 2, 3, 4, 5]);
export const MonsterTierSchema = z.literal([1, 2, 3, 4]);
export const RankSchema = z.literal([1, 2, 3, 4, 5]);
export const PriceSchema = IntSchema(0, MAX_PRICE);
export const BpSchema = IntSchema(-MAX_BP, MAX_BP);
/** A fraction of a quantity (heal, drain, steal, chance, regen): 0..10000 bp, never above 100%. */
export const FractionBpSchema = IntSchema(0, 10_000);
/** A signed fraction (chance deltas, price deltas): -10000..10000 bp. */
export const SignedFractionBpSchema = IntSchema(-10_000, 10_000);
/** A non-negative multiplier (damage, reward): 0..MAX_BP; a negative one would heal the target. */
export const MultiplierBpSchema = IntSchema(0, MAX_BP);

export const NameSchema = z.string().min(1).max(40);
export const DescriptionSchema = z.string().min(1).max(200);
export const TaglineSchema = z.string().min(1).max(120);
