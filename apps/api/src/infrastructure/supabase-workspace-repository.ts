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
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    parentFolderId: row.parent_folder_id,
    name: row.name,
    position: row.position,
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
    version: z.number().int(),
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    name: row.name,
    method: row.method,
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
          "id, workspace_id, collection_id, parent_folder_id, name, position",
        )
        .eq("workspace_id", command.workspaceId)
        .order("position"),
      client
        .from("requests")
        .select(
          "id, workspace_id, collection_id, folder_id, name, method, version",
        )
        .eq("workspace_id", command.workspaceId)
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

  async create(command: CreateWorkspaceCommand): Promise<WorkspaceSummary> {
    const client = this.client(command.accessToken);
    const { data, error } = await client.rpc("create_team_workspace", {
      p_team_name: command.teamName,
      p_workspace_name: command.workspaceName,
    });
    if (error) throw new Error("WORKSPACE_CREATE_FAILED", { cause: error });
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
        "id, workspace_id, collection_id, parent_folder_id, name, position",
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
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select(
        "id, workspace_id, collection_id, folder_id, name, method, version",
      )
      .maybeSingle();
    if (error) {
      if (error.code === "42501" || error.code === "23503") return null;
      throw new Error("REQUEST_CREATE_FAILED", { cause: error });
    }
    return data ? requestRowSchema.parse(data) : null;
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
