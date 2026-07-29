import {
  workspaceSummarySchema,
  workspaceTreeSchema,
  type WorkspaceSummary,
  type WorkspaceTree,
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
