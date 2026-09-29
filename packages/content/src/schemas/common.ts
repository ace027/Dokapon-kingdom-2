import { z } from "zod";
import {
  BOARD_HOOKS,
  COMBAT_HOOKS,
  COMMANDS,
  CONTENT_ID_PATTERN,
  RESERVED_CONTENT_IDS,
  STAT_KEYS,
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

export const HookSchema = z.strictObject({
  hook: z.enum([...COMBAT_HOOKS, ...BOARD_HOOKS]),
  value: IntSchema(-10_000, 100_000),
});

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

export const TierSchema = (max: number) => IntSchema(1, max);
export const PriceSchema = IntSchema(0, MAX_PRICE);
export const BpSchema = IntSchema(-MAX_BP, MAX_BP);

export const NameSchema = z.string().min(1).max(40);
export const DescriptionSchema = z.string().min(1).max(200);
export const TaglineSchema = z.string().min(1).max(120);
