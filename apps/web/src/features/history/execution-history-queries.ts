import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { fetchExecutionHistory } from "./execution-history-api";

export const executionHistoryKeys = {
  list: (workspaceId: string) =>
    ["workspaces", workspaceId, "executions"] as const,
};

export function useExecutionHistory(workspaceId: string, enabled = true) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: executionHistoryKeys.list(workspaceId),
    queryFn: () => fetchExecutionHistory(workspaceId, accessToken!),
    enabled: enabled && Boolean(accessToken),
  });
}
