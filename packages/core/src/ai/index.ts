// Public CPU AI API (`@usurpia/core/ai`). Nothing here may import the reducer, handlers or any
// module exposing GameState (enforced by eslint.config.js).
export {
  combatPolicy,
  createAi,
  decideCombat,
  type AiDecision,
  type AiState,
  type Difficulty,
  type Policy,
} from "./combat";
export { expNeg } from "./exp";
export { AI_TUNING } from "./tuning";
