import {
  apiRequestSchema,
  type ApiRequest,
  requestRevisionsSchema,
  type RequestRevision,
} from "@api-client/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  RequestRepository,
  DeletePersistedRequestCommand,
  FindPersistedRequestCommand,
  UpdatePersistedRequestCommand,
} from "../domain/request-repository.js";
import type { UpdateResult } from "../domain/request-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const databaseRequestSchema = z
  .object({
    id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    collection_id: z.string().uuid().nullable(),
    folder_id: z.string().uuid().nullable(),
    name: z.string(),
    method: z.string(),
    url: z.string(),
    query_params: z.unknown(),
    headers: z.unknown(),
    body: z.unknown(),
    assertions: z.unknown(),
    version: z.number().int().positive(),
    created_by: z.string().uuid(),
    updated_by: z.string().uuid(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    collectionId: row.collection_id,
    folderId: row.folder_id,
    name: row.name,
    method: row.method,
    url: row.url,
    queryParams: row.query_params,
    headers: row.headers,
    body: row.body,
    assertions: row.assertions,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
  .pipe(apiRequestSchema);

const revisionRowsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      request_id: z.string().uuid(),
      version: z.number(),
      name: z.string(),
      method: z.string(),
      change_type: z.string(),
      created_by: z.string().uuid(),
      created_by_name: z.string(),
      created_at: z.string(),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      version: row.version,
      name: row.name,
      method: row.method,
      changeType: row.change_type,
      createdBy: {
        id: row.created_by,
        displayName: row.created_by_name,
      },
      createdAt: row.created_at,
    })),
  )
  .pipe(requestRevisionsSchema);

export class SupabaseRequestRepository implements RequestRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async find(command: FindPersistedRequestCommand): Promise<ApiRequest | null> {
    return this.findVisibleRequest(command.requestId, command.accessToken);
  }

  async listRevisions(
    command: FindPersistedRequestCommand,
  ): Promise<RequestRevision[] | null> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      command.accessToken,
    );
    const { data, error } = await client.rpc("list_request_revisions", {
      p_request_id: command.requestId,
    });
    if (error) {
      if (isPermissionDenied(error)) return null;
      throw new Error("REQUEST_REVISIONS_READ_FAILED", { cause: error });
    }
    const revisions = revisionRowsSchema.parse(data);
    if (revisions.length === 0) {
      const request = await this.findVisibleRequest(
        command.requestId,
        command.accessToken,
      );
      if (!request) return null;
    }
    return revisions;
  }

  async restore(
    command: FindPersistedRequestCommand & {
      revisionId: string;
      expectedVersion: number;
      userId: string;
    },
  ): Promise<UpdateResult> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      command.accessToken,
    );
    const { data, error } = await client.rpc("restore_request_revision", {
      p_request_id: command.requestId,
      p_revision_id: command.revisionId,
      p_expected_version: command.expectedVersion,
    });
    if (!error) {
      return { kind: "updated", request: parseDatabaseRequest(data) };
    }
    return this.mapWriteError(error, command);
  }

  async update(
    command: UpdatePersistedRequestCommand,
  ): Promise<UpdateResult> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      command.accessToken,
    );
    const { data, error } = await client.rpc("update_request_with_revision", {
      p_request_id: command.requestId,
      p_expected_version: command.expectedVersion,
      p_draft: command.draft,
      p_change_type: command.changeType ?? "update",
    });

    if (!error) {
      return {
        kind: "updated",
        request: parseDatabaseRequest(data),
      };
    }
    return this.mapWriteError(error, command);
  }

  async remove(
    command: DeletePersistedRequestCommand,
  ): Promise<UpdateResult> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      command.accessToken,
    );
    const { data, error } = await client.rpc("soft_delete_request", {
      p_request_id: command.requestId,
      p_expected_version: command.expectedVersion,
    });
    if (!error) {
      return { kind: "updated", request: parseDatabaseRequest(data) };
    }
    return this.mapWriteError(error, command);
  }

  private async mapWriteError(
    error: PostgrestError,
    command: FindPersistedRequestCommand & { expectedVersion: number },
  ): Promise<UpdateResult> {
    if (isConflict(error)) {
      const current = await this.findVisibleRequest(
        command.requestId,
        command.accessToken,
      );
      if (!current) return { kind: "not-found" };
      return {
        kind: "conflict",
        conflict: {
          code: "REQUEST_VERSION_CONFLICT",
          message: "Der Request wurde zwischenzeitlich geändert.",
          expectedVersion: command.expectedVersion,
          currentVersion: current.version,
          current,
          updatedBy: {
            id: current.updatedBy,
            displayName: "Teammitglied",
          },
          updatedAt: current.updatedAt,
        },
      };
    }
    if (isPermissionDenied(error)) return { kind: "forbidden" };
    if (isNotFound(error)) return { kind: "not-found" };
    throw new Error("REQUEST_UPDATE_FAILED", { cause: error });
  }

  private async findVisibleRequest(
    requestId: string,
    accessToken: string,
  ): Promise<ApiRequest | null> {
    const client = createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
    const { data, error } = await client
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("REQUEST_CONFLICT_READ_FAILED", { cause: error });
    return data === null ? null : parseDatabaseRequest(data);
  }
}

function parseDatabaseRequest(value: unknown): ApiRequest {
  const normalized =
    Array.isArray(value) && value.length === 1 ? value[0] : value;
  const parsed = databaseRequestSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error("INVALID_DATABASE_REQUEST");
  }
  return parsed.data;
}

function isConflict(error: PostgrestError): boolean {
  return (
    error.code === "40001" || error.message.includes("REQUEST_VERSION_CONFLICT")
  );
}

function isPermissionDenied(error: PostgrestError): boolean {
  return error.code === "42501";
}

function isNotFound(error: PostgrestError): boolean {
  return error.code === "P0002" || error.message.includes("REQUEST_NOT_FOUND");
}
