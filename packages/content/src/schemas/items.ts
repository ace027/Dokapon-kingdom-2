import { z } from "zod";
import {
  BpSchema,
  FractionBpSchema,
  DescriptionSchema,
  IdSchema,
  IntSchema,
  NameSchema,
  PriceSchema,
} from "./common";

const ModStatSchema = z.enum(["atk", "def", "mag", "spd"]);

export const ItemEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("heal"), bp: FractionBpSchema }),
  z.strictObject({ kind: z.literal("cleanse") }),
  z.strictObject({ kind: z.literal("flee") }),
  z.strictObject({ kind: z.literal("mod"), stat: ModStatSchema, bp: BpSchema }),
  z.strictObject({
    kind: z.literal("board"),
    tag: z.enum(["spinBonus", "spinFixed", "warpCastle", "pickSpin", "blockGoldSteal"]),
    value: IntSchema(0, 1_000_000),
  }),
  z.strictObject({
    kind: z.literal("joke"),
    tag: z.enum(["decoyGoldBag", "cursedWig", "whoopeeScroll", "royalSummons", "bagOfBees"]),
  }),
]);

export const ItemEntrySchema = z.strictObject({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  kind: z.enum(["consumable", "joke"]),
  price: PriceSchema,
  use: z.enum(["combat", "board", "both", "none"]),
  effect: ItemEffectSchema,
});

export const ItemsFileSchema = z.strictObject({
  v: z.literal(1),
  items: z.array(ItemEntrySchema),
});

export type ItemEntry = z.infer<typeof ItemEntrySchema>;
export type ItemsFile = z.infer<typeof ItemsFileSchema>;
