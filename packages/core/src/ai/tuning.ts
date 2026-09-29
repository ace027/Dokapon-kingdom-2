/** CPU tuning constants (spec: CPU AI). Read by `combat.ts` and `opponent-model.ts` only. */
export const AI_TUNING = {
  healThresholdBp: 3500,
  easyForgetHealBp: 3000,
  koBonus: 0.5,
  normalTemp: 0.15,
  hardTemp: 0.04,
  hardPriorStrength: 4,
  weightScale: 1_000_000,
} as const;
