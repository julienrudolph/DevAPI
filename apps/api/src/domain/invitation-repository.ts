import type {
  CreateTeamInvitation,
  PendingTeamInvitation,
  TeamInvitation,
} from "@api-client/contracts";

import type { AuthenticatedRepositoryCommand } from "./workspace-repository.js";

export interface CreateInvitationCommand
  extends AuthenticatedRepositoryCommand,
    CreateTeamInvitation {
  teamId: string;
}

export interface AcceptInvitationCommand
  extends AuthenticatedRepositoryCommand {
  token: string;
}

export interface ListInvitationsCommand
  extends AuthenticatedRepositoryCommand {
  teamId: string;
}

export interface RevokeInvitationCommand
  extends AuthenticatedRepositoryCommand {
  invitationId: string;
}

export interface InvitationRepository {
  create(command: CreateInvitationCommand): Promise<TeamInvitation | null>;
  accept(command: AcceptInvitationCommand): Promise<string | null>;
  list(
    command: ListInvitationsCommand,
  ): Promise<PendingTeamInvitation[] | null>;
  revoke(command: RevokeInvitationCommand): Promise<boolean | null>;
}
