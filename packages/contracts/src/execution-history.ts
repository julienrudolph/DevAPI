import { z } from "zod";

import { isoDateTimeSchema } from "./date-time.js";
import { executeRequestSchema } from "./proxy.js";
import { httpMethodSchema } from "./request.js";

export const executeSavedRequestSchema = executeRequestSchema.extend({
  requestId: z.string().uuid(),
});

// Requests executed locally by the desktop client (AGENTS.md 11.1a) never
// send their URL, headers, or body to the server - only enough to record
// the same shared-history metadata a proxied execution would produce.
export const recordLocalExecutionSchema = z.object({
  requestId: z.string().uuid(),
  method: httpMethodSchema,
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().int().nonnegative(),
  successful: z.boolean(),
});

export const requestExecutionSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  requestName: z.string().min(1),
  method: httpMethodSchema,
  statusCode: z.number().int().min(100).max(599),
  durationMs: z.number().int().nonnegative(),
  successful: z.boolean(),
  executedBy: z.object({
    // Null once the executing account has been deleted (AGENTS.md 7.4):
    // the history entry is kept, only the attribution is anonymized.
    id: z.string().uuid().nullable(),
    displayName: z.string().min(1),
  }),
  executedAt: isoDateTimeSchema,
});

export const requestExecutionsSchema = z.array(requestExecutionSchema);

export type ExecuteSavedRequest = z.infer<typeof executeSavedRequestSchema>;
export type RecordLocalExecution = z.infer<typeof recordLocalExecutionSchema>;
export type RequestExecution = z.infer<typeof requestExecutionSchema>;
