import { z } from "zod";
import {
  FractionBpSchema,
  IntSchema,
  MAX_BP,
  MultiplierBpSchema,
  PriceSchema,
  SignedFractionBpSchema,
  StatBlockSchema,
} from "./common";
import { MAX_STAT } from "@usurpia/core";

const MatrixRowSchema = z.strictObject({
  guard: MultiplierBpSchema,
  counter: MultiplierBpSchema,
  ward: MultiplierBpSchema,
  open: MultiplierBpSchema,
});

/**
 * Ranges follow the engine: damage multipliers are non-negative (a negative one would heal the
 * target past its max hp), chances and fractions stay within 0..10000, `modMinBp <= 0 <= modMaxBp`
 * (battle mods start at 0) and `fleeMinBp <= fleeMaxBp` (the clamp is `min(max, max(min, raw))`).
 */
const CombatSchema = z
  .strictObject({
    kBp: MultiplierBpSchema,
    jBp: MultiplierBpSchema,
    jMagBp: MultiplierBpSchema,
    matrix: z.strictObject({
      attack: MatrixRowSchema,
      strike: MatrixRowSchema,
      spell: MatrixRowSchema,
    }),
    critBaseBp: FractionBpSchema,
    critPerLuckBp: FractionBpSchema,
    critCapBp: FractionBpSchema,
    critMultBp: MultiplierBpSchema,
    maxRounds: IntSchema(1, 10),
    fleeBaseBp: FractionBpSchema,
    fleePerSpdBp: SignedFractionBpSchema,
    fleeMinBp: FractionBpSchema,
    fleeMaxBp: FractionBpSchema,
    modMinBp: IntSchema(-10_000, 0),
    modMaxBp: IntSchema(0, MAX_BP),
    poisonBp: FractionBpSchema,
    seniorRewardBp: MultiplierBpSchema,
    pvpXpPerLevel: PriceSchema,
  })
  .superRefine((combat, ctx) => {
    // Only when both bounds are individually valid: an out-of-range bound already has its own error.
    const valid = (bp: number): boolean => bp >= 0 && bp <= 10_000;
    if (valid(combat.fleeMinBp) && valid(combat.fleeMaxBp) && combat.fleeMinBp > combat.fleeMaxBp) {
      ctx.addIssue({
        code: "custom",
        path: ["fleeMinBp"],
        message: "fleeMinBp must be at most fleeMaxBp",
      });
    }
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
