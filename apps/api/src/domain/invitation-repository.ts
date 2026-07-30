import type {
  CreateTeamInvitation,
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

export interface InvitationRepository {
  create(command: CreateInvitationCommand): Promise<TeamInvitation | null>;
  accept(command: AcceptInvitationCommand): Promise<string | null>;
}
