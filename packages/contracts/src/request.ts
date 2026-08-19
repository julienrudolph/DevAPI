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
  z.object({
    type: z.literal("form-urlencoded"),
    content: z.string().max(1_048_576),
  }),
  z.object({
    type: z.literal("multipart"),
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

export const assertionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().uuid(),
    type: z.literal("status"),
    operator: z.enum(["equals", "notEquals"]),
    expected: z.number().int().min(100).max(599),
  }),
  z.object({
    id: z.string().uuid(),
    type: z.literal("jsonPath"),
    path: z.string().trim().min(1).max(512),
    operator: z.enum(["exists", "notExists", "equals", "notEquals", "contains"]),
    expected: z.string().max(4_096).optional(),
  }),
]);

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
  assertions: z.array(assertionSchema).max(50).default([]),
});

export const apiRequestSchema = requestDraftSchema.extend({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  folderId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
  // Null once the creating/updating account has been deleted (AGENTS.md 7.4).
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const updateRequestSchema = requestDraftSchema.extend({
  expectedVersion: z.number().int().positive(),
  overwrite: z.boolean().optional(),
  collectionId: z.string().uuid().optional(),
  folderId: z.string().uuid().nullable().optional(),
});

export const deleteRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const requestIdParamsSchema = z.object({
  requestId: z.string().uuid(),
});

export type ApiRequest = z.infer<typeof apiRequestSchema>;
export type RequestDraft = z.infer<typeof requestDraftSchema>;
export type RequestAuth = z.infer<typeof requestAuthSchema>;
export type Assertion = z.infer<typeof assertionSchema>;
export type UpdateRequest = z.infer<typeof updateRequestSchema>;
export type DeleteRequest = z.infer<typeof deleteRequestSchema>;
