import {
  collectionSummarySchema,
  createCollectionSchema,
  createWorkspaceSchema,
  workspaceSummarySchema,
  workspaceTreeSchema,
  type WorkspaceSummary,
  type WorkspaceTree,
  type CreateCollection,
  type CreateWorkspace,
  type CollectionSummary,
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
