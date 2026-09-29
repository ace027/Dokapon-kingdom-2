import type { ContentId } from "./rules";
import type { NpcRef, PlayerId } from "./types";

export type Opponent = { kind: "player"; playerId: PlayerId } | { kind: "npc"; npc: NpcRef };

/**
 * The action union. Every action is `{ v: 2, type, playerId, ...payload }` with exactly the listed
 * keys. The W1b members are the three decision actions, 02-03 adds `combat/start` and
 * `system/setCharacter`; later waves extend this union,
 * `ACTION_TYPES` and the handler map together.
 */
export type Action =
  | {
      v: 2;
      type: "decision/open";
      playerId: "system";
      prompts: { playerId: PlayerId; options: string[]; default: string }[];
    }
  | { v: 2; type: "decision/commit"; playerId: PlayerId; decisionId: string; choice: string }
  | { v: 2; type: "timeout"; playerId: "system"; decisionId: string }
  | { v: 2; type: "combat/start"; playerId: "system"; attacker: PlayerId; opponent: Opponent }
  | {
      v: 2;
      type: "system/setCharacter";
      playerId: "system";
      target: PlayerId;
      classId: ContentId;
      level: number;
      weapon: ContentId | null;
      shield: ContentId | null;
      accessory: ContentId | null;
      battleSpell: ContentId | null;
      wardSpell: ContentId | null;
      bag: ContentId[];
    };

export type ActionType = Action["type"];

export const ACTION_TYPES: readonly ActionType[] = [
  "decision/open",
  "decision/commit",
  "timeout",
  "combat/start",
  "system/setCharacter",
];
