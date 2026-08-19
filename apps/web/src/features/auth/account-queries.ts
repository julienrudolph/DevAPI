import { useMutation, useQuery } from "@tanstack/react-query";

import type { DeleteAccount } from "@api-client/contracts";

import { useAuth } from "./auth-context";
import { deleteAccount, fetchAccountDeletionCheck } from "./account-api";

export const accountKeys = {
  deletionCheck: ["account", "deletion-check"] as const,
};

export function useAccountDeletionCheck() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: accountKeys.deletionCheck,
    queryFn: () => fetchAccountDeletionCheck(accessToken!),
    enabled: Boolean(accessToken),
  });
}

export function useDeleteAccount() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (input: DeleteAccount) => deleteAccount(input, accessToken!),
  });
}
