import { COMBAT_HOOKS, type CombatHook, type Hook } from "../rules";

export type HookTotals = Readonly<Record<CombatHook, number>>;

/**
 * Sums hook values per combat hook. One exhaustive `switch` with no `default`: adding a hook name
 * to `COMBAT_HOOKS`/`BOARD_HOOKS` fails typecheck here until it is handled. Board hooks are
 * accepted and ignored in Phase 2.
 */
export function applyPassives(hooks: readonly Hook[]): HookTotals {
  const totals: Record<CombatHook, number> = Object.fromEntries(
    COMBAT_HOOKS.map((name): [CombatHook, number] => [name, 0]),
  ) as Record<CombatHook, number>;
  for (const hook of hooks) addHook(totals, hook);
  return totals;
}

function addHook(totals: Record<CombatHook, number>, hook: Hook): void {
  switch (hook.hook) {
    case "hpBp":
    case "atkBp":
    case "defBp":
    case "magBp":
    case "spdBp":
    case "luckBp":
    case "attackDmgBp":
    case "strikeDmgBp":
    case "spellDmgBp":
    case "guardVsStrikeBp":
    case "counterDmgBp":
    case "wardReflectBp":
    case "critBp":
    case "fleeBp":
    case "lifestealBp":
    case "roundRegenBp":
    case "spellTakenBp":
    case "physTakenBp":
    case "spellbladeStrike":
    case "poisonOnHit":
    case "stealGoldOnHitBp":
    case "stealItemOnHit":
      totals[hook.hook] += hook.value;
      return;
    case "pvpExtraSteal":
    case "passPickpocketBp":
    case "spellPriceBp":
    case "fieldSpellMove":
    case "turnRegenBp":
    case "townTaxBp":
    case "crownTaxResistBp":
    case "lootLuckBp":
      return;
  }
  // Exhaustiveness: a new hook name makes `hook.hook` non-`never` here and fails typecheck.
  const _never: never = hook.hook;
  return _never;
}
