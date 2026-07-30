import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { requestKeys } from "../requests/request-queries";
import { workspaceKeys } from "../workspaces/workspace-queries";
import {
  fetchRequestRevisions,
  restoreRequestRevision,
} from "./revision-api";

export const revisionKeys = {
  list: (requestId: string) => ["requests", requestId, "revisions"] as const,
};

export function useRequestRevisions(requestId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: revisionKeys.list(requestId),
    queryFn: () => fetchRequestRevisions(requestId, accessToken!),
    enabled: Boolean(accessToken),
  });
}

export function useRestoreRequestRevision(
  workspaceId: string,
  requestId: string,
) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof restoreRequestRevision>[1]) =>
      restoreRequestRevision(requestId, input, accessToken!),
    onSuccess: async (request) => {
      queryClient.setQueryData(requestKeys.detail(requestId), request);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: revisionKeys.list(requestId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.tree(workspaceId),
        }),
      ]);
    },
  });
}
