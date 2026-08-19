import {
  acceptedTeamInvitationSchema,
  pendingTeamInvitationsSchema,
  teamInvitationSchema,
  type PendingTeamInvitation,
  type TeamInvitation,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  AcceptInvitationCommand,
  CreateInvitationCommand,
  InvitationRepository,
  ListInvitationsCommand,
  RevokeInvitationCommand,
} from "../domain/invitation-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const invitationRowSchema = z
  .object({
    id: z.string().uuid(),
    team_id: z.string().uuid(),
    role: z.string(),
    token: z.string(),
    expires_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    teamId: row.team_id,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
  }))
  .pipe(teamInvitationSchema);

const pendingInvitationRowsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      team_id: z.string().uuid(),
      role: z.string(),
      created_at: z.string(),
      expires_at: z.string(),
      created_by_id: z.string().uuid(),
      created_by_display_name: z.string(),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      teamId: row.team_id,
      role: row.role,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      createdBy: {
        id: row.created_by_id,
        displayName: row.created_by_display_name,
      },
    })),
  )
  .pipe(pendingTeamInvitationsSchema);

export class SupabaseInvitationRepository
  implements InvitationRepository
{
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async create(
    command: CreateInvitationCommand,
  ): Promise<TeamInvitation | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("create_team_invitation", {
      p_team_id: command.teamId,
      p_role: command.role,
    });
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("INVITATION_CREATE_FAILED", { cause: error });
    }
    const rows = z.array(invitationRowSchema).parse(data);
    return rows[0] ?? null;
  }

  async accept(command: AcceptInvitationCommand): Promise<string | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("accept_team_invitation", {
      p_token: command.token,
    });
    if (error) {
      if (error.code === "P0002") return null;
      throw new Error("INVITATION_ACCEPT_FAILED", { cause: error });
    }
    return acceptedTeamInvitationSchema.parse({ teamId: data }).teamId;
  }

  async list(
    command: ListInvitationsCommand,
  ): Promise<PendingTeamInvitation[] | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("list_team_invitations", {
      p_team_id: command.teamId,
    });
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("INVITATIONS_LIST_FAILED", { cause: error });
    }
    return pendingInvitationRowsSchema.parse(data);
  }

  async revoke(command: RevokeInvitationCommand): Promise<boolean | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("revoke_team_invitation", {
      p_invitation_id: command.invitationId,
    });
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("INVITATION_REVOKE_FAILED", { cause: error });
    }
    return z.boolean().parse(data);
  }

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}
