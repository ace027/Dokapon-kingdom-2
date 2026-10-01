import { z } from "zod";
import {
  checkHookRange,
  CommandWeightsSchema,
  DescriptionSchema,
  hookShape,
  IdSchema,
  IntSchema,
  RankSchema,
  LoadoutSchema,
  MAX_BP,
  NameSchema,
  PriceSchema,
  StatBlockSchema,
} from "./common";

export const PassiveEntrySchema = z
  .strictObject({
    ...hookShape,
    rank: RankSchema,
    id: IdSchema,
    name: NameSchema,
    description: DescriptionSchema,
  })
  .superRefine(checkHookRange);

export const ClassEntrySchema = z.strictObject({
  id: IdSchema,
  name: NameSchema,
  description: DescriptionSchema,
  kind: z.enum(["base", "hybrid"]),
  parents: z.tuple([IdSchema, IdSchema]).nullable(),
  statBp: StatBlockSchema(1, MAX_BP),
  bagSize: IntSchema(1, 16),
  switchFee: PriceSchema,
  passives: z.array(PassiveEntrySchema),
  starter: LoadoutSchema.nullable(),
  aiBias: CommandWeightsSchema,
});

export const ClassesFileSchema = z.strictObject({
  v: z.literal(1),
  classes: z.array(ClassEntrySchema),
});

export type ClassEntry = z.infer<typeof ClassEntrySchema>;
export type ClassesFile = z.infer<typeof ClassesFileSchema>;
