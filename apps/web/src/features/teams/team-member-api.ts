import {
  teamMembersSchema,
  transferTeamOwnershipSchema,
  updateTeamMemberSchema,
  type TeamMember,
  type TransferTeamOwnership,
  type UpdateTeamMember,
} from "@api-client/contracts";

export async function fetchTeamMembers(
  teamId: string,
  accessToken: string,
): Promise<TeamMember[]> {
  const response = await fetch(`/api/v1/teams/${teamId}/members`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`TEAM_MEMBERS_FETCH_${response.status}`);
  return teamMembersSchema.parse(await response.json());
}

export async function updateTeamMember(
  teamId: string,
  userId: string,
  input: UpdateTeamMember,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`/api/v1/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateTeamMemberSchema.parse(input)),
  });
  if (!response.ok) throw new Error(`TEAM_MEMBER_UPDATE_${response.status}`);
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`/api/v1/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`TEAM_MEMBER_REMOVE_${response.status}`);
}

export async function transferTeamOwnership(
  teamId: string,
  input: TransferTeamOwnership,
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/teams/${teamId}/ownership-transfer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transferTeamOwnershipSchema.parse(input)),
    },
  );
  if (!response.ok) {
    throw new Error(`TEAM_OWNERSHIP_TRANSFER_${response.status}`);
  }
}
