import { z } from "zod";

import { isoDateTimeSchema } from "./date-time.js";

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

export const keyValueEntrySchema = z.object({
  id: z.string().uuid(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean().default(true),
});

export const requestBodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none"), content: z.string().optional() }),
  z.object({
    type: z.literal("json"),
    content: z.string().max(1_048_576),
  }),
  z.object({
    type: z.literal("text"),
    content: z.string().max(1_048_576),
  }),
]).superRefine((body, context) => {
  if (body.type === "json") {
      try {
        JSON.parse(body.content);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["content"],
          message: "Der JSON-Body ist ungültig.",
        });
      }
  }
});

export const requestAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({
    type: z.literal("bearer"),
    token: z.string().max(8_192),
  }),
  z.object({
    type: z.literal("basic"),
    username: z.string().max(1_024),
    password: z.string().max(8_192),
  }),
]);

export const requestDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  method: httpMethodSchema,
  url: z.string().trim().min(1).max(8_192),
  queryParams: z.array(keyValueEntrySchema).max(200),
  headers: z.array(keyValueEntrySchema).max(200),
  body: requestBodySchema,
});

export const apiRequestSchema = requestDraftSchema.extend({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  folderId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  createdBy: z.string().uuid(),
  updatedBy: z.string().uuid(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const updateRequestSchema = requestDraftSchema.extend({
  expectedVersion: z.number().int().positive(),
  overwrite: z.boolean().optional(),
});

export const requestIdParamsSchema = z.object({
  requestId: z.string().uuid(),
});

export type ApiRequest = z.infer<typeof apiRequestSchema>;
export type RequestDraft = z.infer<typeof requestDraftSchema>;
export type RequestAuth = z.infer<typeof requestAuthSchema>;
export type UpdateRequest = z.infer<typeof updateRequestSchema>;
