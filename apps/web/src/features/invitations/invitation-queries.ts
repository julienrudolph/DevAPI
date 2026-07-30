import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { workspaceKeys } from "../workspaces/workspace-queries";
import { acceptInvitation, createInvitation } from "./invitation-api";

export function useCreateInvitation(teamId: string) {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: Parameters<typeof createInvitation>[1]) =>
      createInvitation(teamId, input, accessToken!),
  });
}

export function useAcceptInvitation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
}
