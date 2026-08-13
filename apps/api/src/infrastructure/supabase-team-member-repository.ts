import {
  teamMembersSchema,
  type TeamMember,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  ChangeTeamMemberCommand,
  RemoveTeamMemberCommand,
  TeamCommand,
  TeamMemberRepository,
  TransferTeamOwnershipCommand,
} from "../domain/team-member-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const memberRowsSchema = z
  .array(
    z.object({
      user_id: z.string().uuid(),
      email: z.string(),
      display_name: z.string(),
      role: z.string(),
      joined_at: z.string(),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      joinedAt: row.joined_at,
    })),
  )
  .pipe(teamMembersSchema);

export class SupabaseTeamMemberRepository implements TeamMemberRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async list(command: TeamCommand): Promise<TeamMember[] | null> {
    const { data, error } = await this.client(command.accessToken).rpc(
      "list_team_members",
      { p_team_id: command.teamId },
    );
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("TEAM_MEMBERS_LIST_FAILED", { cause: error });
    }
    return memberRowsSchema.parse(data);
  }

  async update(command: ChangeTeamMemberCommand): Promise<boolean | null> {
    const { data, error } = await this.client(command.accessToken).rpc(
      "update_team_member_role",
      {
        p_team_id: command.teamId,
        p_user_id: command.targetUserId,
        p_role: command.role,
      },
    );
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("TEAM_MEMBER_UPDATE_FAILED", { cause: error });
    }
    return z.boolean().parse(data);
  }

  async remove(command: RemoveTeamMemberCommand): Promise<boolean | null> {
    const { data, error } = await this.client(command.accessToken).rpc(
      "remove_team_member",
      {
        p_team_id: command.teamId,
        p_user_id: command.targetUserId,
      },
    );
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("TEAM_MEMBER_REMOVE_FAILED", { cause: error });
    }
    return z.boolean().parse(data);
  }

  async transferOwnership(
    command: TransferTeamOwnershipCommand,
  ): Promise<boolean | null> {
    const { data, error } = await this.client(command.accessToken).rpc(
      "transfer_team_ownership",
      {
        p_team_id: command.teamId,
        p_new_owner_user_id: command.newOwnerUserId,
      },
    );
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("TEAM_OWNERSHIP_TRANSFER_FAILED", { cause: error });
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
