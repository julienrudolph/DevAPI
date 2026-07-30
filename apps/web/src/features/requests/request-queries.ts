import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateRequest } from "@api-client/contracts";

import { useAuth } from "../auth/auth-context";
import { executionHistoryKeys } from "../history/execution-history-queries";
import { workspaceKeys } from "../workspaces/workspace-queries";
import { fetchRequest, updateRequest } from "./request-api";
import { executeRequest } from "./request-execution-api";

export const requestKeys = {
  detail: (requestId: string) => ["requests", requestId] as const,
};

export function useRequest(requestId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: requestKeys.detail(requestId),
    queryFn: () => fetchRequest(requestId, accessToken!),
    enabled: accessToken !== null,
  });
}

export function useUpdateRequest(workspaceId: string, requestId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRequest) =>
      updateRequest(requestId, input, accessToken!),
    onSuccess: (request) => {
      queryClient.setQueryData(requestKeys.detail(requestId), request);
      void queryClient.invalidateQueries({
        queryKey: workspaceKeys.tree(workspaceId),
      });
    },
  });
}

export function useExecuteRequest(workspaceId?: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof executeRequest>[0]) =>
      executeRequest(input, accessToken!),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: executionHistoryKeys.list(workspaceId),
        });
      }
    },
  });
}
