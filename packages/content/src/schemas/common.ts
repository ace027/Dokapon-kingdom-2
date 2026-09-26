import { z } from "zod";

export const IdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,47}$/, "id must be kebab-case, start with a letter, max 48 chars");
