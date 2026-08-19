import { z } from "zod";

import { isoDateTimeSchema } from "./date-time.js";
import { httpMethodSchema } from "./request.js";

export const requestRevisionSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  version: z.number().int().positive(),
  name: z.string().min(1),
  method: httpMethodSchema,
  changeType: z.enum(["update", "overwrite", "restore", "delete"]),
  createdBy: z.object({
    // Null once the creating account has been deleted (AGENTS.md 7.3):
    // the revision itself is kept, only the attribution is anonymized.
    id: z.string().uuid().nullable(),
    displayName: z.string().min(1),
  }),
  createdAt: isoDateTimeSchema,
});

export const requestRevisionsSchema = z.array(requestRevisionSchema);

export const restoreRequestRevisionSchema = z.object({
  revisionId: z.string().uuid(),
  expectedVersion: z.number().int().positive(),
});

export type RequestRevision = z.infer<typeof requestRevisionSchema>;
export type RestoreRequestRevision = z.infer<
  typeof restoreRequestRevisionSchema
>;
