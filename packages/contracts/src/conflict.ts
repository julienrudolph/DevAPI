import { z } from "zod";

import { isoDateTimeSchema } from "./date-time.js";
import { apiRequestSchema } from "./request.js";

export const requestConflictSchema = z.object({
  code: z.literal("REQUEST_VERSION_CONFLICT"),
  message: z.string(),
  expectedVersion: z.number().int().positive(),
  currentVersion: z.number().int().positive(),
  current: apiRequestSchema,
  updatedBy: z.object({
    id: z.string().uuid(),
    displayName: z.string().min(1),
  }),
  updatedAt: isoDateTimeSchema,
});

export type RequestConflict = z.infer<typeof requestConflictSchema>;
