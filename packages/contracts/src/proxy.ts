import { z } from "zod";

import { httpMethodSchema, keyValueEntrySchema } from "./request.js";

export const executeRequestSchema = z.object({
  method: httpMethodSchema,
  url: z.string().trim().min(1).max(8_192),
  headers: z.array(keyValueEntrySchema).max(200).default([]),
  body: z.string().max(1_048_576).optional(),
});

export const proxyResponseSchema = z.object({
  status: z.number().int().min(100).max(599),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  durationMs: z.number().nonnegative(),
});

export type ExecuteRequest = z.infer<typeof executeRequestSchema>;
export type ProxyResponse = z.infer<typeof proxyResponseSchema>;

// Returned by the desktop app's main process over IPC (AGENTS.md 11.1a) -
// not a network-crossing contract, so no zod schema, but shared so the
// renderer and main process agree on the exact shape.
export type LocalExecutionResult =
  | { ok: true; response: ProxyResponse }
  | { ok: false; code: string; message: string };
