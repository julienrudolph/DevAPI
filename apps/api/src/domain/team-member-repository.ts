import type { TeamMember, UpdateTeamMember } from "@api-client/contracts";

import type { AuthenticatedRepositoryCommand } from "./workspace-repository.js";

export interface TeamCommand extends AuthenticatedRepositoryCommand {
  teamId: string;
}

export interface ChangeTeamMemberCommand
  extends TeamCommand,
    UpdateTeamMember {
  targetUserId: string;
}

export interface RemoveTeamMemberCommand extends TeamCommand {
  targetUserId: string;
}

export interface TransferTeamOwnershipCommand extends TeamCommand {
  newOwnerUserId: string;
}

export interface TeamMemberRepository {
  list(command: TeamCommand): Promise<TeamMember[] | null>;
  update(command: ChangeTeamMemberCommand): Promise<boolean | null>;
  remove(command: RemoveTeamMemberCommand): Promise<boolean | null>;
  transferOwnership(
    command: TransferTeamOwnershipCommand,
  ): Promise<boolean | null>;
}
