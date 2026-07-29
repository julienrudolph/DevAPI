import { z } from "zod";

import { httpMethodSchema } from "./request.js";
import { workspaceRoleSchema } from "./role.js";

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export const createWorkspaceSchema = z.object({
  teamName: z.string().trim().min(1).max(160),
  workspaceName: z.string().trim().min(1).max(160),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
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
});

export const requestSummarySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  folderId: z.string().uuid().nullable(),
  name: z.string().min(1).max(160),
  method: httpMethodSchema,
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
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;
export type FolderSummary = z.infer<typeof folderSummarySchema>;
export type RequestSummary = z.infer<typeof requestSummarySchema>;
export type WorkspaceTree = z.infer<typeof workspaceTreeSchema>;
