import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import {
  createEnvironment,
  createEnvironmentVariable,
  fetchEnvironments,
} from "./environment-api";

export const environmentKeys = {
  list: (workspaceId: string) =>
    ["workspaces", workspaceId, "environments"] as const,
};

export function useEnvironments(workspaceId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: environmentKeys.list(workspaceId ?? "none"),
    queryFn: () => fetchEnvironments(workspaceId!, accessToken!),
    enabled: accessToken !== null && workspaceId !== undefined,
  });
}

export function useCreateEnvironment(workspaceId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createEnvironment>[1]) =>
      createEnvironment(workspaceId, input, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: environmentKeys.list(workspaceId),
      });
    },
  });
}

export function useCreateEnvironmentVariable(
  workspaceId: string,
  environmentId: string,
) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof createEnvironmentVariable>[1]) =>
      createEnvironmentVariable(environmentId, input, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: environmentKeys.list(workspaceId),
      });
    },
  });
}
