import {
  collectionSummarySchema,
  createCollectionSchema,
  createFolderSchema,
  createRequestSummarySchema,
  createWorkspaceSchema,
  deleteNavigationItemSchema,
  folderSummarySchema,
  requestSummarySchema,
  updateNavigationItemSchema,
  workspaceSummarySchema,
  workspaceTreeSchema,
  type WorkspaceSummary,
  type WorkspaceTree,
  type CreateCollection,
  type CreateWorkspace,
  type CollectionSummary,
  type CreateFolder,
  type CreateRequestSummary,
  type FolderSummary,
  type RequestSummary,
  type UpdateNavigationItem,
} from "@api-client/contracts";
import { z } from "zod";

export class NavigationMutationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export async function fetchWorkspaces(
  accessToken: string,
): Promise<WorkspaceSummary[]> {
  const response = await fetch("/api/v1/workspaces", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`WORKSPACE_LIST_${response.status}`);
  return z.array(workspaceSummarySchema).parse(await response.json());
}

export async function createWorkspace(
  input: CreateWorkspace,
  accessToken: string,
): Promise<WorkspaceSummary> {
  const response = await fetch("/api/v1/workspaces", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createWorkspaceSchema.parse(input)),
  });
  if (!response.ok) throw new Error(`WORKSPACE_CREATE_${response.status}`);
  return workspaceSummarySchema.parse(await response.json());
}

export async function createCollection(
  workspaceId: string,
  input: CreateCollection,
  accessToken: string,
): Promise<CollectionSummary> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/collections`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createCollectionSchema.parse(input)),
    },
  );
  if (!response.ok) throw new Error(`COLLECTION_CREATE_${response.status}`);
  return collectionSummarySchema.parse(await response.json());
}

export async function createFolder(
  workspaceId: string,
  input: CreateFolder,
  accessToken: string,
): Promise<FolderSummary> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/folders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createFolderSchema.parse(input)),
  });
  if (!response.ok) throw new Error(`FOLDER_CREATE_${response.status}`);
  return folderSummarySchema.parse(await response.json());
}

export async function createRequest(
  workspaceId: string,
  input: CreateRequestSummary,
  accessToken: string,
): Promise<RequestSummary> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/requests`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createRequestSummarySchema.parse(input)),
  });
  if (!response.ok) throw new Error(`REQUEST_CREATE_${response.status}`);
  return requestSummarySchema.parse(await response.json());
}

export async function deleteCollection(
  collectionId: string,
  expectedVersion: number,
  accessToken: string,
): Promise<void> {
  return deleteNavigationItem(
    `/api/v1/collections/${collectionId}`,
    expectedVersion,
    accessToken,
  );
}

export async function deleteFolder(
  folderId: string,
  expectedVersion: number,
  accessToken: string,
): Promise<void> {
  return deleteNavigationItem(
    `/api/v1/folders/${folderId}`,
    expectedVersion,
    accessToken,
  );
}

export async function updateCollection(
  collectionId: string,
  input: UpdateNavigationItem,
  accessToken: string,
): Promise<CollectionSummary> {
  return updateNavigationItem(
    `/api/v1/collections/${collectionId}`,
    input,
    accessToken,
    collectionSummarySchema,
  );
}

export async function updateFolder(
  folderId: string,
  input: UpdateNavigationItem,
  accessToken: string,
): Promise<FolderSummary> {
  return updateNavigationItem(
    `/api/v1/folders/${folderId}`,
    input,
    accessToken,
    folderSummarySchema,
  );
}

async function deleteNavigationItem(
  url: string,
  expectedVersion: number,
  accessToken: string,
): Promise<void> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      deleteNavigationItemSchema.parse({ expectedVersion }),
    ),
  });
  if (response.ok) return;
  const payload: unknown = await response.json().catch(() => undefined);
  const code =
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    typeof payload.code === "string"
      ? payload.code
      : `NAVIGATION_DELETE_${response.status}`;
  throw new NavigationMutationError(code);
}

async function updateNavigationItem<T>(
  url: string,
  input: UpdateNavigationItem,
  accessToken: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateNavigationItemSchema.parse(input)),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "string"
        ? payload.code
        : `NAVIGATION_UPDATE_${response.status}`;
    throw new NavigationMutationError(code);
  }
  return schema.parse(await response.json());
}

export async function fetchWorkspaceTree(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceTree> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/tree`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`WORKSPACE_TREE_${response.status}`);
  return workspaceTreeSchema.parse(await response.json());
}
