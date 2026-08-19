import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "../auth/auth-context";
import { workspaceKeys } from "../workspaces/workspace-queries";
import {
  acceptInvitation,
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
} from "./invitation-api";

export const invitationKeys = {
  pending: (teamId: string) => ["invitations", "pending", teamId] as const,
};

export function useCreateInvitation(teamId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  // Stable for the lifetime of this hook instance (i.e. this dialog), so a
  // user retrying after a failed attempt safely replays the same logical
  // request instead of risking a second invitation link (AGENTS.md 14).
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: (input: Parameters<typeof createInvitation>[1]) =>
      createInvitation(teamId, input, accessToken!, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: invitationKeys.pending(teamId),
      });
    },
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

export function usePendingInvitations(teamId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: invitationKeys.pending(teamId),
    queryFn: () => listPendingInvitations(teamId, accessToken!),
    enabled: accessToken !== null,
  });
}

export function useRevokeInvitation(teamId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      revokeInvitation(teamId, invitationId, accessToken!),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: invitationKeys.pending(teamId),
      });
    },
  });
}
