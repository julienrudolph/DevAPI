import { z } from "zod";

import {
  httpMethodSchema,
  keyValueEntrySchema,
  requestBodySchema,
} from "./request.js";
import { workspaceRoleSchema } from "./role.js";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const collectionIdParamsSchema = z.object({
  collectionId: z.string().uuid(),
});

export const folderIdParamsSchema = z.object({
  folderId: z.string().uuid(),
});

export const deleteNavigationItemSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const updateNavigationItemSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(1).max(160).optional(),
    targetPosition: z.number().int().nonnegative().optional(),
  })
  .refine(
    ({ name, targetPosition }) =>
      name !== undefined || targetPosition !== undefined,
    { message: "Name oder Zielposition ist erforderlich." },
  );

export const updateFolderNavigationSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    name: z.string().trim().min(1).max(160).optional(),
    targetPosition: z.number().int().nonnegative().optional(),
    destination: z
      .object({
        collectionId: z.string().uuid(),
        parentFolderId: z.string().uuid().nullable(),
      })
      .optional(),
  })
  .refine(
    ({ destination, name, targetPosition }) =>
      destination !== undefined ||
      name !== undefined ||
      targetPosition !== undefined,
    { message: "Name, Zielposition oder Zielordner ist erforderlich." },
  );

export const createWorkspaceSchema = z.union([
  z.object({
    teamName: z.string().trim().min(1).max(160),
    workspaceName: z.string().trim().min(1).max(160),
  }),
  z.object({
    teamId: z.string().uuid(),
    workspaceName: z.string().trim().min(1).max(160),
  }),
]);

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
});

export const createFolderSchema = z.object({
  collectionId: z.string().uuid(),
  parentFolderId: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(160),
});

export const createRequestSummarySchema = z.object({
  collectionId: z.string().uuid(),
  folderId: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(160),
  method: httpMethodSchema.default("GET"),
  url: z.string().trim().min(1).max(8_192).default("https://"),
  queryParams: z.array(keyValueEntrySchema).max(200).default([]),
  headers: z.array(keyValueEntrySchema).max(200).default([]),
  body: requestBodySchema.default({ type: "none" }),
});

export const workspaceSummarySchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().min(1).max(160),
  role: workspaceRoleSchema,
});

export const collectionSummarySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(160),
  position: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const folderSummarySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  collectionId: z.string().uuid(),
  parentFolderId: z.string().uuid().nullable(),
  name: z.string().min(1).max(160),
  position: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const requestSummarySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  folderId: z.string().uuid().nullable(),
  name: z.string().min(1).max(160),
  method: httpMethodSchema,
  url: z.string().max(8_192).default(""),
  version: z.number().int().positive(),
});

export const workspaceTreeSchema = z.object({
  workspaceId: z.string().uuid(),
  collections: z.array(collectionSummarySchema),
  folders: z.array(folderSummarySchema),
  requests: z.array(requestSummarySchema),
});

export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;
export type CreateWorkspace = z.infer<typeof createWorkspaceSchema>;
export type CreateCollection = z.infer<typeof createCollectionSchema>;
export type CreateFolder = z.infer<typeof createFolderSchema>;
export type CreateRequestSummary = z.infer<typeof createRequestSummarySchema>;
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
export type FolderSummary = z.infer<typeof folderSummarySchema>;
export type RequestSummary = z.infer<typeof requestSummarySchema>;
export type WorkspaceTree = z.infer<typeof workspaceTreeSchema>;
export type DeleteNavigationItem = z.infer<
  typeof deleteNavigationItemSchema
>;
export type UpdateNavigationItem = z.infer<
  typeof updateNavigationItemSchema
>;
export type UpdateFolderNavigation = z.infer<
  typeof updateFolderNavigationSchema
>;
