import { z } from "zod";

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
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("json"), content: z.string() }),
  z.object({ type: z.literal("text"), content: z.string() }),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateRequestSchema = requestDraftSchema.extend({
  expectedVersion: z.number().int().positive(),
});

export const requestIdParamsSchema = z.object({
  requestId: z.string().uuid(),
});

export type ApiRequest = z.infer<typeof apiRequestSchema>;
export type RequestDraft = z.infer<typeof requestDraftSchema>;
export type UpdateRequest = z.infer<typeof updateRequestSchema>;
