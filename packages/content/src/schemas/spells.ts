import { z } from "zod";
import {
  BpSchema,
  FractionBpSchema,
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
  z.strictObject({ kind: z.literal("drain"), bp: FractionBpSchema }),
  z.strictObject({ kind: z.literal("stealGold"), bp: FractionBpSchema }),
]);

const common = {
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  tier: TierSchema,
  price: PriceSchema,
};

export const BattleSpellEntrySchema = z.strictObject({
  ...common,
  powerBp: IntSchema(0, MAX_BP),
  effect: SpellEffectSchema,
});

/** `valueBp` is a multiplier (counterspell) or the reflected fraction (reflect: at most 100%). */
export const WardSpellEntrySchema = z
  .strictObject({
    ...common,
    mode: z.enum(["barrier", "reflect", "absorb", "counterspell"]),
    valueBp: IntSchema(0, MAX_BP),
  })
  .superRefine((ward, ctx) => {
    if (ward.mode === "reflect" && ward.valueBp > 10_000) {
      ctx.addIssue({
        code: "custom",
        path: ["valueBp"],
        message: "reflect valueBp must be at most 10000",
      });
    }
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
