import { z } from "zod";
import { IdSchema } from "./common";

export const ItemSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1).max(40),
  kind: z.enum(["consumable", "gear", "joke"]),
  price: z.number().int().min(0),
  description: z.string().min(1).max(200),
});

export const ItemsFileSchema = z.strictObject({
  v: z.literal(1),
  items: z.array(ItemSchema).min(1),
});

export type Item = z.infer<typeof ItemSchema>;
