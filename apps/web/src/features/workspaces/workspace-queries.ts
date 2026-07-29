import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import {
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

export function useWorkspaceTree(workspaceId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: workspaceKeys.tree(workspaceId ?? "none"),
    queryFn: () => fetchWorkspaceTree(workspaceId!, accessToken!),
    enabled: accessToken !== null && workspaceId !== undefined,
  });
}
