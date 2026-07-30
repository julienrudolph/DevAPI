import { z } from "zod";

import { executeRequestSchema } from "./proxy.js";
import { httpMethodSchema } from "./request.js";

export const executeSavedRequestSchema = executeRequestSchema.extend({
  requestId: z.string().uuid(),
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
    id: z.string().uuid(),
    displayName: z.string().min(1),
  }),
  executedAt: z.string().datetime(),
});

export const requestExecutionsSchema = z.array(requestExecutionSchema);

export type ExecuteSavedRequest = z.infer<typeof executeSavedRequestSchema>;
export type RequestExecution = z.infer<typeof requestExecutionSchema>;
