import { z } from "zod";
import { BpSchema, IntSchema, PriceSchema, StatBlockSchema } from "./common";
import { MAX_STAT } from "@usurpia/core";

const MatrixRowSchema = z.strictObject({
  guard: BpSchema,
  counter: BpSchema,
  ward: BpSchema,
  open: BpSchema,
});

const CombatSchema = z.strictObject({
  kBp: BpSchema,
  jBp: BpSchema,
  jMagBp: BpSchema,
  matrix: z.strictObject({
    attack: MatrixRowSchema,
    strike: MatrixRowSchema,
    spell: MatrixRowSchema,
  }),
  critBaseBp: BpSchema,
  critPerLuckBp: BpSchema,
  critCapBp: BpSchema,
  critMultBp: BpSchema,
  maxRounds: IntSchema(1, 10),
  fleeBaseBp: BpSchema,
  fleePerSpdBp: BpSchema,
  fleeMinBp: BpSchema,
  fleeMaxBp: BpSchema,
  modMinBp: BpSchema,
  modMaxBp: BpSchema,
  poisonBp: BpSchema,
  seniorRewardBp: BpSchema,
  pvpXpPerLevel: PriceSchema,
});

const ProgressionSchema = z.strictObject({
  maxLevel: IntSchema(1, 99),
  xpCurve: z.array(z.number().int()),
  baseStats: StatBlockSchema(0, MAX_STAT),
  growth: StatBlockSchema(0, MAX_STAT),
  masteryWins: z.array(z.number().int()),
  hybridUnlockRank: z.number().int(),
});

const EconomySchema = z.strictObject({
  startingGold: PriceSchema,
  maxScrolls: IntSchema(0, 9),
});

export const TuningFileSchema = z.strictObject({
  v: z.literal(1),
  combat: CombatSchema,
  progression: ProgressionSchema,
  economy: EconomySchema,
});

export type TuningFile = z.infer<typeof TuningFileSchema>;
