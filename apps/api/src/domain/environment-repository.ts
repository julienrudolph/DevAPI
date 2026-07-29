import type {
  CreateEnvironment,
  Environment,
  EnvironmentVariable,
  UpsertEnvironmentVariable,
  UpdateEnvironmentVariable,
} from "@api-client/contracts";

import type { AuthenticatedRepositoryCommand } from "./workspace-repository.js";

export interface WorkspaceEnvironmentCommand
  extends AuthenticatedRepositoryCommand {
  workspaceId: string;
}

export interface CreateEnvironmentCommand
  extends WorkspaceEnvironmentCommand,
    CreateEnvironment {}

export interface CreateEnvironmentVariableCommand
  extends AuthenticatedRepositoryCommand,
    UpsertEnvironmentVariable {
  environmentId: string;
}

export type CreateVariableResult =
  | { kind: "created"; variable: EnvironmentVariable }
  | { kind: "forbidden" }
  | { kind: "duplicate" };

export interface UpdateEnvironmentVariableCommand
  extends AuthenticatedRepositoryCommand,
    UpdateEnvironmentVariable {
  variableId: string;
}

export type UpdateVariableResult =
  | { kind: "updated"; variable: EnvironmentVariable }
  | { kind: "conflict"; current: EnvironmentVariable }
  | { kind: "forbidden" }
  | { kind: "not-found" };

export interface EnvironmentRepository {
  list(command: WorkspaceEnvironmentCommand): Promise<Environment[]>;
  create(command: CreateEnvironmentCommand): Promise<Environment | null>;
  createVariable(
    command: CreateEnvironmentVariableCommand,
  ): Promise<CreateVariableResult>;
  updateVariable(
    command: UpdateEnvironmentVariableCommand,
  ): Promise<UpdateVariableResult>;
}
