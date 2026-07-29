import type {
  CollectionSummary,
  CreateCollection,
  CreateFolder,
  CreateRequestSummary,
  CreateWorkspace,
  FolderSummary,
  RequestSummary,
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

export interface CreateFolderCommand
  extends AuthenticatedRepositoryCommand,
    CreateFolder {
  workspaceId: string;
}

export interface CreateRequestCommand
  extends AuthenticatedRepositoryCommand,
    CreateRequestSummary {
  workspaceId: string;
}

export interface WorkspaceRepository {
  list(command: AuthenticatedRepositoryCommand): Promise<WorkspaceSummary[]>;
  getTree(command: WorkspaceTreeCommand): Promise<WorkspaceTree | null>;
  create(command: CreateWorkspaceCommand): Promise<WorkspaceSummary>;
  createCollection(
    command: CreateCollectionCommand,
  ): Promise<CollectionSummary | null>;
  createFolder(command: CreateFolderCommand): Promise<FolderSummary | null>;
  createRequest(command: CreateRequestCommand): Promise<RequestSummary | null>;
}
