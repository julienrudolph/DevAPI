import {
  collectionSummarySchema,
  createCollectionSchema,
  createFolderSchema,
  createRequestSummarySchema,
  createWorkspaceSchema,
  folderSummarySchema,
  requestSummarySchema,
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
} from "@api-client/contracts";
import { z } from "zod";

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
