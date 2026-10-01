import { z } from "zod";
import {
  DescriptionSchema,
  HookSchema,
  IdSchema,
  NameSchema,
  PriceSchema,
  StatBlockSchema,
  TierSchema,
} from "./common";

export const GearEntrySchema = z.strictObject({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  slot: z.enum(["weapon", "shield", "accessory"]),
  tier: TierSchema,
  price: PriceSchema,
  stats: StatBlockSchema(-999, 999),
  hooks: z.array(HookSchema),
});

export const GearFileSchema = z.strictObject({
  v: z.literal(1),
  gear: z.array(GearEntrySchema),
});

export type GearEntry = z.infer<typeof GearEntrySchema>;
export type GearFile = z.infer<typeof GearFileSchema>;
