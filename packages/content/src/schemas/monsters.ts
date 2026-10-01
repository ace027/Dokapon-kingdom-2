import { z } from "zod";
import { MAX_STAT } from "@usurpia/core";
import {
  AttackTableSchema,
  DefendTableSchema,
  DescriptionSchema,
  HookSchema,
  IdSchema,
  IntSchema,
  MAX_BP,
  NameSchema,
  PriceSchema,
  StatBlockSchema,
  TaglineSchema,
  MonsterTierSchema,
  statShape,
} from "./common";

/** One NPC stat-curve row: 0..MAX_STAT per stat, hp at least 1. */
const CurveRowSchema = z.strictObject({ ...statShape(0, MAX_STAT), hp: IntSchema(1, MAX_STAT) });

const npcBase = {
  id: IdSchema,
  name: NameSchema,
  statBp: StatBlockSchema(1, MAX_BP),
  attackTable: AttackTableSchema,
  defendTable: DefendTableSchema,
  battleSpell: IdSchema.nullable(),
  wardSpell: IdSchema.nullable(),
  hooks: z.array(HookSchema),
};

export const MonsterEntrySchema = z.strictObject({
  ...npcBase,
  tagline: TaglineSchema,
  tier: MonsterTierSchema,
  zone: IdSchema,
  xp: PriceSchema,
  gold: PriceSchema,
});

export const GuardianEntrySchema = z.strictObject({
  ...npcBase,
  description: DescriptionSchema,
  style: z.enum(["magic", "physical", "balanced"]),
  xpPerTier: PriceSchema,
  goldPerTier: PriceSchema,
});

/** No `style` key: only guardians have one. */
export const EnforcerEntrySchema = z.strictObject({
  ...npcBase,
  description: DescriptionSchema,
  xpPerLevel: PriceSchema,
  goldPerLevel: PriceSchema,
});

export const MonstersFileSchema = z.strictObject({
  v: z.literal(1),
  curve: z.array(CurveRowSchema),
  monsters: z.array(MonsterEntrySchema),
  guardians: z.array(GuardianEntrySchema),
  enforcer: EnforcerEntrySchema,
});

export type MonstersFile = z.infer<typeof MonstersFileSchema>;
