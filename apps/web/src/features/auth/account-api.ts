import {
  deleteAccountSchema,
  soleOwnerTeamsSchema,
  type DeleteAccount,
  type SoleOwnerTeam,
} from "@api-client/contracts";

export async function fetchAccountDeletionCheck(
  accessToken: string,
): Promise<SoleOwnerTeam[]> {
  const response = await fetch("/api/v1/account/deletion-check", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`ACCOUNT_DELETION_CHECK_${response.status}`);
  }
  return soleOwnerTeamsSchema.parse(await response.json());
}

export class AccountDeletionError extends Error {
  constructor(
    public readonly code: string,
    public readonly blockingTeams: SoleOwnerTeam[] = [],
  ) {
    super(code);
  }
}

export async function deleteAccount(
  input: DeleteAccount,
  accessToken: string,
): Promise<void> {
  const response = await fetch("/api/v1/account/delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deleteAccountSchema.parse(input)),
  });
  if (response.ok) return;

  if (response.status === 409) {
    const body = (await response.json()) as {
      code: string;
      teams?: SoleOwnerTeam[];
    };
    throw new AccountDeletionError(body.code, body.teams ?? []);
  }
  throw new AccountDeletionError(`ACCOUNT_DELETE_${response.status}`);
}
