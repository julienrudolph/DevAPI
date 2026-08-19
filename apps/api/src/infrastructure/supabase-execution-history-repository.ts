import {
  requestExecutionsSchema,
  type RequestExecution,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  ExecutionHistoryRepository,
  ListExecutionsCommand,
  RecordExecutionCommand,
} from "../domain/execution-history-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const executionRowsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      request_id: z.string().uuid(),
      request_name: z.string(),
      method: z.string(),
      status_code: z.number(),
      duration_ms: z.number(),
      successful: z.boolean(),
      executed_by: z.string().uuid().nullable(),
      executed_by_name: z.string(),
      executed_at: z.string(),
    }),
  )
  .transform((rows) =>
    rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      requestName: row.request_name,
      method: row.method,
      statusCode: row.status_code,
      durationMs: row.duration_ms,
      successful: row.successful,
      executedBy: {
        id: row.executed_by,
        displayName: row.executed_by_name,
      },
      executedAt: row.executed_at,
    })),
  )
  .pipe(requestExecutionsSchema);

export class SupabaseExecutionHistoryRepository
  implements ExecutionHistoryRepository
{
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async record(command: RecordExecutionCommand): Promise<void> {
    const { error } = await this.client(command.accessToken).rpc(
      "record_request_execution",
      {
        p_request_id: command.requestId,
        p_method: command.method,
        p_status_code: command.statusCode,
        p_duration_ms: Math.round(command.durationMs),
        p_successful: command.successful,
      },
    );
    if (error) {
      throw new Error("EXECUTION_HISTORY_RECORD_FAILED", { cause: error });
    }
  }

  async list(
    command: ListExecutionsCommand,
  ): Promise<RequestExecution[] | null> {
    const { data, error } = await this.client(command.accessToken).rpc(
      "list_request_executions",
      { p_workspace_id: command.workspaceId },
    );
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("EXECUTION_HISTORY_LIST_FAILED", { cause: error });
    }
    return executionRowsSchema.parse(data);
  }

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}
