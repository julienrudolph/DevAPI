import type {
  CollectionSummary,
  CreateCollection,
  CreateWorkspace,
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

export interface CreateWorkspaceCommand
  extends AuthenticatedRepositoryCommand,
    CreateWorkspace {}

export interface CreateCollectionCommand
  extends AuthenticatedRepositoryCommand,
    CreateCollection {
  workspaceId: string;
}

export interface WorkspaceRepository {
  list(command: AuthenticatedRepositoryCommand): Promise<WorkspaceSummary[]>;
  getTree(command: WorkspaceTreeCommand): Promise<WorkspaceTree | null>;
  create(command: CreateWorkspaceCommand): Promise<WorkspaceSummary>;
  createCollection(
    command: CreateCollectionCommand,
  ): Promise<CollectionSummary | null>;
}
