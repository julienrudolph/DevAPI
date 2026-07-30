import type {
  RequestExecution,
  ExecuteRequest,
} from "@api-client/contracts";

import type { AuthenticatedRepositoryCommand } from "./workspace-repository.js";

export interface RecordExecutionCommand
  extends AuthenticatedRepositoryCommand {
  requestId: string;
  method: ExecuteRequest["method"];
  statusCode: number;
  durationMs: number;
  successful: boolean;
}

export interface ListExecutionsCommand
  extends AuthenticatedRepositoryCommand {
  workspaceId: string;
}

export interface ExecutionHistoryRepository {
  record(command: RecordExecutionCommand): Promise<void>;
  list(command: ListExecutionsCommand): Promise<RequestExecution[] | null>;
}
