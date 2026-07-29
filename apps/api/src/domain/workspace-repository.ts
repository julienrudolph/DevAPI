import type {
  WorkspaceSummary,
  WorkspaceTree,
} from "@api-client/contracts";

export interface AuthenticatedRepositoryCommand {
  userId: string;
  accessToken: string;
}

export interface WorkspaceTreeCommand extends AuthenticatedRepositoryCommand {
  workspaceId: string;
}

export interface WorkspaceRepository {
  list(command: AuthenticatedRepositoryCommand): Promise<WorkspaceSummary[]>;
  getTree(command: WorkspaceTreeCommand): Promise<WorkspaceTree | null>;
}
