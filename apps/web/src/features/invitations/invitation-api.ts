import {
  acceptedTeamInvitationSchema,
  createTeamInvitationSchema,
  teamInvitationSchema,
  type CreateTeamInvitation,
  type TeamInvitation,
} from "@api-client/contracts";

export async function createInvitation(
  teamId: string,
  input: CreateTeamInvitation,
  accessToken: string,
  idempotencyKey?: string,
): Promise<TeamInvitation> {
  const response = await fetch(`/api/v1/teams/${teamId}/invitations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(createTeamInvitationSchema.parse(input)),
  });
  if (!response.ok) throw new Error(`INVITATION_CREATE_${response.status}`);
  return teamInvitationSchema.parse(await response.json());
}

export async function acceptInvitation(
  token: string,
  accessToken: string,
): Promise<string> {
  const response = await fetch("/api/v1/invitations/accept", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(`INVITATION_ACCEPT_${response.status}`);
  return acceptedTeamInvitationSchema.parse(await response.json()).teamId;
}
