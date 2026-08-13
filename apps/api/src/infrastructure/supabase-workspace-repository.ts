import {
  collectionSummarySchema,
  folderSummarySchema,
  requestSummarySchema,
  workspaceSummarySchema,
  type CollectionSummary,
  type FolderSummary,
  type RequestSummary,
  type WorkspaceSummary,
  type WorkspaceTree,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  AuthenticatedRepositoryCommand,
  CreateCollectionCommand,
  CreateFolderCommand,
  CreateRequestCommand,
  CreateWorkspaceCommand,
  DeleteNavigationItemCommand,
  DeleteNavigationItemResult,
  UpdateCollectionResult,
  UpdateFolderNavigationItemCommand,
  UpdateFolderResult,
  UpdateNavigationItemCommand,
  WorkspaceRepository,
  WorkspaceTreeCommand,
} from "../domain/workspace-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const workspaceRowSchema = z
  .object({
    id: z.string().uuid(),
    team_id: z.string().uuid(),
    name: z.string(),
    workspace_members: z.array(z.object({ role: z.string() })).length(1),
  })
  .transform((row) => ({
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.workspace_members[0]!.role,
  }))
  .pipe(workspaceSummarySchema);

const collectionRowSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    name: z.string(),
    position: z.number().int(),
    version: z.number().int(),
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    position: row.position,
    version: row.version,
  }))
  .pipe(collectionSummarySchema);

const folderRowSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    collection_id: z.string().uuid(),
    parent_folder_id: z.string().uuid().nullable(),
    name: z.string(),
    position: z.number().int(),
    version: z.number().int(),
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    parentFolderId: row.parent_folder_id,
    name: row.name,
    position: row.position,
    version: row.version,
  }))
  .pipe(folderSummarySchema);

const requestRowSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    collection_id: z.string().uuid().nullable(),
    folder_id: z.string().uuid().nullable(),
    name: z.string(),
    method: z.string(),
    url: z.string(),
    version: z.number().int(),
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    name: row.name,
    method: row.method,
    url: row.url,
    version: row.version,
  }))
  .pipe(requestSummarySchema);

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async list(
    command: AuthenticatedRepositoryCommand,
  ): Promise<WorkspaceSummary[]> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("workspaces")
      .select("id, team_id, name, workspace_members!inner(role)")
      .eq("workspace_members.user_id", command.userId)
      .order("name");
    if (error) throw new Error("WORKSPACE_LIST_FAILED", { cause: error });
    return parseRows(data, workspaceRowSchema);
  }

  async getTree(command: WorkspaceTreeCommand): Promise<WorkspaceTree | null> {
    const client = this.client(command.accessToken);
    const workspace = await client
      .from("workspaces")
      .select("id")
      .eq("id", command.workspaceId)
      .maybeSingle();
    if (workspace.error) {
      throw new Error("WORKSPACE_READ_FAILED", { cause: workspace.error });
    }
    if (!workspace.data) return null;

    const [collections, folders, requests] = await Promise.all([
      client
        .from("collections")
        .select("id, workspace_id, name, position, version")
        .eq("workspace_id", command.workspaceId)
        .order("position"),
      client
        .from("folders")
        .select(
          "id, workspace_id, collection_id, parent_folder_id, name, position, version",
        )
        .eq("workspace_id", command.workspaceId)
        .order("position"),
      client
        .from("requests")
        .select(
          "id, workspace_id, collection_id, folder_id, name, method, url, version",
        )
        .eq("workspace_id", command.workspaceId)
        .is("deleted_at", null)
        .order("name"),
    ]);
    if (collections.error || folders.error || requests.error) {
      throw new Error("WORKSPACE_TREE_FAILED");
    }

    return {
      workspaceId: command.workspaceId,
      collections: parseRows(collections.data, collectionRowSchema),
      folders: parseRows(folders.data, folderRowSchema),
      requests: parseRows(requests.data, requestRowSchema),
    };
  }

  async create(
    command: CreateWorkspaceCommand,
  ): Promise<WorkspaceSummary | null> {
    const client = this.client(command.accessToken);
    const { data, error } =
      "teamId" in command
        ? await client.rpc("create_workspace_in_team", {
            p_team_id: command.teamId,
            p_workspace_name: command.workspaceName,
          })
        : await client.rpc("create_team_workspace", {
            p_team_name: command.teamName,
            p_workspace_name: command.workspaceName,
          });
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("WORKSPACE_CREATE_FAILED", { cause: error });
    }
    const rows = parseRows(data, z.object({
      id: z.string().uuid(),
      team_id: z.string().uuid(),
      name: z.string(),
      role: z.string(),
    }).transform((row) => ({
      id: row.id,
      teamId: row.team_id,
      name: row.name,
      role: row.role,
    })).pipe(workspaceSummarySchema));
    const workspace = rows[0];
    if (!workspace) throw new Error("INVALID_WORKSPACE_CREATE_RESPONSE");
    return workspace;
  }

  async createCollection(
    command: CreateCollectionCommand,
  ): Promise<CollectionSummary | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("collections")
      .insert({
        workspace_id: command.workspaceId,
        name: command.name,
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select("id, workspace_id, name, position, version")
      .maybeSingle();
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("COLLECTION_CREATE_FAILED", { cause: error });
    }
    return data ? collectionRowSchema.parse(data) : null;
  }

  async createFolder(
    command: CreateFolderCommand,
  ): Promise<FolderSummary | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("folders")
      .insert({
        workspace_id: command.workspaceId,
        collection_id: command.collectionId,
        parent_folder_id: command.parentFolderId,
        name: command.name,
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select(
        "id, workspace_id, collection_id, parent_folder_id, name, position, version",
      )
      .maybeSingle();
    if (error) {
      if (error.code === "42501" || error.code === "23503") return null;
      throw new Error("FOLDER_CREATE_FAILED", { cause: error });
    }
    return data ? folderRowSchema.parse(data) : null;
  }

  async createRequest(
    command: CreateRequestCommand,
  ): Promise<RequestSummary | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("requests")
      .insert({
        workspace_id: command.workspaceId,
        collection_id: command.collectionId,
        folder_id: command.folderId,
        name: command.name,
        method: command.method,
        url: command.url,
        query_params: command.queryParams,
        headers: command.headers,
        body: command.body,
        assertions: command.assertions,
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select(
        "id, workspace_id, collection_id, folder_id, name, method, url, version",
      )
      .maybeSingle();
    if (error) {
      if (error.code === "42501" || error.code === "23503") return null;
      throw new Error("REQUEST_CREATE_FAILED", { cause: error });
    }
    return data ? requestRowSchema.parse(data) : null;
  }

  async deleteCollection(
    command: DeleteNavigationItemCommand,
  ): Promise<DeleteNavigationItemResult> {
    return this.deleteNavigationItem(
      "delete_empty_collection",
      "p_collection_id",
      command,
    );
  }

  async deleteFolder(
    command: DeleteNavigationItemCommand,
  ): Promise<DeleteNavigationItemResult> {
    return this.deleteNavigationItem(
      "delete_empty_folder",
      "p_folder_id",
      command,
    );
  }

  async updateCollection(
    command: UpdateNavigationItemCommand,
  ): Promise<UpdateCollectionResult> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("update_collection_navigation", {
      p_collection_id: command.itemId,
      p_expected_version: command.expectedVersion,
      p_name: command.name,
      p_target_position: command.targetPosition,
    });
    if (!error) {
      return {
        kind: "updated",
        item: collectionRowSchema.parse(normalizeRpcRow(data)),
      };
    }
    return mapNavigationUpdateError(error);
  }

  async updateFolder(
    command: UpdateFolderNavigationItemCommand,
  ): Promise<UpdateFolderResult> {
    const client = this.client(command.accessToken);
    if (command.destination) {
      const { data, error } = await client.rpc("move_folder_navigation", {
        p_folder_id: command.itemId,
        p_expected_version: command.expectedVersion,
        p_collection_id: command.destination.collectionId,
        p_parent_folder_id: command.destination.parentFolderId,
      });
      if (!error) {
        return {
          kind: "updated",
          item: folderRowSchema.parse(normalizeRpcRow(data)),
        };
      }
      return mapNavigationUpdateError(error);
    }
    const { data, error } = await client.rpc("update_folder_navigation", {
      p_folder_id: command.itemId,
      p_expected_version: command.expectedVersion,
      p_name: command.name,
      p_target_position: command.targetPosition,
    });
    if (!error) {
      return {
        kind: "updated",
        item: folderRowSchema.parse(normalizeRpcRow(data)),
      };
    }
    return mapNavigationUpdateError(error);
  }

  private async deleteNavigationItem(
    functionName: "delete_empty_collection" | "delete_empty_folder",
    idParameter: "p_collection_id" | "p_folder_id",
    command: DeleteNavigationItemCommand,
  ): Promise<DeleteNavigationItemResult> {
    const client = this.client(command.accessToken);
    const { error } = await client.rpc(functionName, {
      [idParameter]: command.itemId,
      p_expected_version: command.expectedVersion,
    });
    if (!error) return { kind: "deleted" };
    if (error.code === "40001") return { kind: "conflict" };
    if (error.code === "42501") return { kind: "forbidden" };
    if (error.code === "P0002") return { kind: "not-found" };
    if (
      error.message.includes("COLLECTION_NOT_EMPTY") ||
      error.message.includes("FOLDER_NOT_EMPTY")
    ) {
      return { kind: "not-empty" };
    }
    throw new Error("NAVIGATION_DELETE_FAILED", { cause: error });
  }

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}

function parseRows<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T[] {
  const rows = z.array(schema).safeParse(value);
  if (!rows.success) throw new Error("INVALID_DATABASE_RESPONSE");
  return rows.data;
}

function normalizeRpcRow(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function mapNavigationUpdateError(error: {
  code: string;
  message?: string;
}): Exclude<
  UpdateCollectionResult,
  { kind: "updated" }
> {
  if (
    error.code === "40001" ||
    error.message?.includes("FOLDER_VERSION_CONFLICT") ||
    error.message?.includes("COLLECTION_VERSION_CONFLICT")
  ) {
    return { kind: "conflict" };
  }
  if (error.code === "42501") return { kind: "forbidden" };
  if (error.code === "P0002") return { kind: "not-found" };
  throw new Error("NAVIGATION_UPDATE_FAILED", { cause: error });
}
