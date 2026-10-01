import type { ContentId } from "./rules";
import type { NpcRef, PlayerId, SCHEMA_VERSION } from "./types";

export type Opponent = { kind: "player"; playerId: PlayerId } | { kind: "npc"; npc: NpcRef };

export type Grant =
  | { kind: "item" | "scroll" | "gear" | "battleSpell" | "wardSpell"; id: ContentId }
  | { kind: "gold" | "xp"; amount: number };

/**
 * The action union. Every action is `{ v: SCHEMA_VERSION, type, playerId, ...payload }` with
 * exactly the listed keys. The handler map (`HandlerMap`) is keyed by `Action["type"]`, so adding a
 * member here without a handler is a compile error. System actions (`playerId: "system"`) are for
 * the host; players send `decision/commit` and the `loadout/*` actions.
 */
export type Action =
  | {
      v: typeof SCHEMA_VERSION;
      type: "decision/open";
      playerId: "system";
      prompts: { playerId: PlayerId; options: string[]; default: string }[];
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "decision/commit";
      playerId: PlayerId;
      decisionId: string;
      choice: string;
    }
  | { v: typeof SCHEMA_VERSION; type: "timeout"; playerId: "system"; decisionId: string }
  | {
      v: typeof SCHEMA_VERSION;
      type: "combat/start";
      playerId: "system";
      attacker: PlayerId;
      opponent: Opponent;
    }
  | {
      v: typeof SCHEMA_VERSION;
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
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "system/grant";
      playerId: "system";
      target: PlayerId;
      grant: Grant;
    }
  | {
      v: typeof SCHEMA_VERSION;
      type: "loadout/switchClass";
      playerId: PlayerId;
      classId: ContentId;
      discard: ContentId[];
    }
  | { v: typeof SCHEMA_VERSION; type: "loadout/discard"; playerId: PlayerId; itemId: ContentId }
  | { v: typeof SCHEMA_VERSION; type: "loadout/useItem"; playerId: PlayerId; itemId: ContentId }
  | {
      v: typeof SCHEMA_VERSION;
      type: "loadout/setPortable";
      playerId: PlayerId;
      classId: ContentId | null;
    };

export type ActionType = Action["type"];
