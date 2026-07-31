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

export type CreateWorkspaceCommand =
  AuthenticatedRepositoryCommand & CreateWorkspace;

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

export interface DeleteNavigationItemCommand
  extends AuthenticatedRepositoryCommand {
  itemId: string;
  expectedVersion: number;
}

export type DeleteNavigationItemResult =
  | { kind: "deleted" }
  | { kind: "conflict" }
  | { kind: "not-empty" }
  | { kind: "forbidden" }
  | { kind: "not-found" };

export interface UpdateNavigationItemCommand
  extends AuthenticatedRepositoryCommand {
  itemId: string;
  expectedVersion: number;
  name?: string;
  targetPosition?: number;
}

export type UpdateCollectionResult =
  | { kind: "updated"; item: CollectionSummary }
  | Exclude<DeleteNavigationItemResult, { kind: "deleted" | "not-empty" }>;

export type UpdateFolderResult =
  | { kind: "updated"; item: FolderSummary }
  | Exclude<DeleteNavigationItemResult, { kind: "deleted" | "not-empty" }>;

export interface WorkspaceRepository {
  list(command: AuthenticatedRepositoryCommand): Promise<WorkspaceSummary[]>;
  getTree(command: WorkspaceTreeCommand): Promise<WorkspaceTree | null>;
  create(command: CreateWorkspaceCommand): Promise<WorkspaceSummary | null>;
  createCollection(
    command: CreateCollectionCommand,
  ): Promise<CollectionSummary | null>;
  createFolder(command: CreateFolderCommand): Promise<FolderSummary | null>;
  createRequest(command: CreateRequestCommand): Promise<RequestSummary | null>;
  deleteCollection?(
    command: DeleteNavigationItemCommand,
  ): Promise<DeleteNavigationItemResult>;
  deleteFolder?(
    command: DeleteNavigationItemCommand,
  ): Promise<DeleteNavigationItemResult>;
  updateCollection?(
    command: UpdateNavigationItemCommand,
  ): Promise<UpdateCollectionResult>;
  updateFolder?(
    command: UpdateNavigationItemCommand,
  ): Promise<UpdateFolderResult>;
}
