import {
  acceptedTeamInvitationSchema,
  teamInvitationSchema,
  type TeamInvitation,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  AcceptInvitationCommand,
  CreateInvitationCommand,
  InvitationRepository,
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

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}
