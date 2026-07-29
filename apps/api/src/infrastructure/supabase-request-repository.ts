import {
  apiRequestSchema,
  type ApiRequest,
} from "@api-client/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  RequestRepository,
  FindPersistedRequestCommand,
  UpdatePersistedRequestCommand,
} from "../domain/request-repository.js";
import type { UpdateResult } from "../domain/request-store.js";
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
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
  .pipe(apiRequestSchema);

export class SupabaseRequestRepository implements RequestRepository {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async find(command: FindPersistedRequestCommand): Promise<ApiRequest | null> {
    return this.findVisibleRequest(command.requestId, command.accessToken);
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
