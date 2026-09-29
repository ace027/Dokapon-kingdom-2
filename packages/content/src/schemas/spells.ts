import { z } from "zod";
import {
  BpSchema,
  DescriptionSchema,
  IdSchema,
  IntSchema,
  MAX_BP,
  NameSchema,
  PriceSchema,
  TierSchema,
} from "./common";

const SpellEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("stun"), chanceBp: IntSchema(0, 10_000) }),
  z.strictObject({
    kind: z.literal("mod"),
    stat: z.enum(["atk", "def", "mag", "spd"]),
    bp: BpSchema,
  }),
  z.strictObject({ kind: z.literal("drain"), bp: BpSchema }),
  z.strictObject({ kind: z.literal("stealGold"), bp: BpSchema }),
]);

const common = {
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  tier: TierSchema(5),
  price: PriceSchema,
};

export const BattleSpellEntrySchema = z.strictObject({
  ...common,
  powerBp: IntSchema(0, MAX_BP),
  effect: SpellEffectSchema,
});

export const WardSpellEntrySchema = z.strictObject({
  ...common,
  mode: z.enum(["barrier", "reflect", "absorb", "counterspell"]),
  valueBp: BpSchema,
});

export const FieldSpellEntrySchema = z.strictObject({
  ...common,
  tag: z.enum([
    "spinTwiceHigher",
    "spinCap",
    "seizeTown",
    "fullHealCleanse",
    "hideAndImmune",
    "doubleGoldSpace",
    "swapPositions",
    "blockFieldSpells",
  ]),
  value: IntSchema(0, 1_000_000),
  duration: IntSchema(0, 100),
});

export const SpellsFileSchema = z.strictObject({
  v: z.literal(1),
  battle: z.array(BattleSpellEntrySchema),
  ward: z.array(WardSpellEntrySchema),
  field: z.array(FieldSpellEntrySchema),
});

export type SpellsFile = z.infer<typeof SpellsFileSchema>;
