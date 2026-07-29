import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WorkspaceSummary } from "@api-client/contracts";

import { useAuth } from "../auth/auth-context";
import {
  createCollection,
  createWorkspace,
  fetchWorkspaces,
  fetchWorkspaceTree,
} from "./workspace-api";

export const workspaceKeys = {
  all: ["workspaces"] as const,
  tree: (workspaceId: string) =>
    ["workspaces", workspaceId, "tree"] as const,
};

export function useWorkspaces() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => fetchWorkspaces(accessToken!),
    enabled: accessToken !== null,
  });
}

export function useCreateWorkspace() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createWorkspace>[0]) =>
      createWorkspace(input, accessToken!),
    onSuccess: (workspace) => {
      queryClient.setQueryData(
        workspaceKeys.all,
        (current: WorkspaceSummary[] | undefined) => [
          ...(current ?? []),
          workspace,
        ],
      );
    },
  });
}

export function useCreateCollection(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createCollection>[1]) =>
      createCollection(workspaceId, input, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useWorkspaceTree(workspaceId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: workspaceKeys.tree(workspaceId ?? "none"),
    queryFn: () => fetchWorkspaceTree(workspaceId!, accessToken!),
    enabled: accessToken !== null && workspaceId !== undefined,
  });
}
