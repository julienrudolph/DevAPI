import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-context";
import { workspaceKeys } from "../workspaces/workspace-queries";
import {
  fetchTeamMembers,
  removeTeamMember,
  transferTeamOwnership,
  updateTeamMember,
} from "./team-member-api";

export const teamMemberKeys = {
  list: (teamId: string) => ["teams", teamId, "members"] as const,
};

export function useTeamMembers(teamId: string) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: teamMemberKeys.list(teamId),
    queryFn: () => fetchTeamMembers(teamId, accessToken!),
    enabled: Boolean(accessToken),
  });
}

export function useUpdateTeamMember(teamId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      role,
      userId,
    }: {
      role: "editor" | "viewer";
      userId: string;
    }) => updateTeamMember(teamId, userId, { role }, accessToken!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamMemberKeys.list(teamId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
      ]);
    },
  });
}

export function useRemoveTeamMember(teamId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      removeTeamMember(teamId, userId, accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: teamMemberKeys.list(teamId),
      });
    },
  });
}

export function useTransferTeamOwnership(teamId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newOwnerUserId: string) =>
      transferTeamOwnership(teamId, { newOwnerUserId }, accessToken!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamMemberKeys.list(teamId) }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
      ]);
    },
  });
}
