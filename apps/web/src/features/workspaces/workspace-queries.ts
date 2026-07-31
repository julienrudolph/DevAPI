import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  WorkspaceSummary,
  WorkspaceTree,
} from "@api-client/contracts";

import { useAuth } from "../auth/auth-context";
import {
  createCollection,
  createFolder,
  createRequest,
  createWorkspace,
  deleteCollection,
  deleteFolder,
  fetchWorkspaces,
  fetchWorkspaceTree,
  updateCollection,
  updateFolder,
} from "./workspace-api";
import { fetchRequest } from "../requests/request-api";
import {
  createWorkspaceExport,
  downloadWorkspaceExport,
} from "../export/workspace-export";

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

export function useExportWorkspace() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: async ({
      tree,
      workspace,
    }: {
      tree: WorkspaceTree;
      workspace: WorkspaceSummary;
    }) => {
      const requests = await Promise.all(
        tree.requests.map(({ id }) => fetchRequest(id, accessToken!)),
      );
      downloadWorkspaceExport(
        workspace.name,
        createWorkspaceExport(workspace, tree, requests),
      );
    },
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

export function useCreateFolder(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createFolder>[1]) =>
      createFolder(workspaceId, input, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useCreateRequest(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createRequest>[1]) =>
      createRequest(workspaceId, input, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useDeleteCollection(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { collectionId: string; expectedVersion: number }) =>
      deleteCollection(input.collectionId, input.expectedVersion, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useDeleteFolder(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { folderId: string; expectedVersion: number }) =>
      deleteFolder(input.folderId, input.expectedVersion, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useUpdateCollection(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      collectionId: string;
      expectedVersion: number;
      name?: string;
      targetPosition?: number;
    }) =>
      updateCollection(
        input.collectionId,
        {
          expectedVersion: input.expectedVersion,
          name: input.name,
          targetPosition: input.targetPosition,
        },
        accessToken!,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useUpdateFolder(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      folderId: string;
      expectedVersion: number;
      name?: string;
      targetPosition?: number;
    }) =>
      updateFolder(
        input.folderId,
        {
          expectedVersion: input.expectedVersion,
          name: input.name,
          targetPosition: input.targetPosition,
        },
        accessToken!,
      ),
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
