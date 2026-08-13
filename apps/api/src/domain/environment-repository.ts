import type {
  CreateEnvironment,
  DeleteEnvironment,
  DeleteEnvironmentVariable,
  Environment,
  EnvironmentVariable,
  UpdateEnvironment,
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

export interface UpdateEnvironmentCommand
  extends AuthenticatedRepositoryCommand,
    UpdateEnvironment {
  environmentId: string;
}

export type UpdateEnvironmentResult =
  | { kind: "updated"; environment: Environment }
  | { kind: "conflict"; current: Environment }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "duplicate" };

export interface DeleteEnvironmentCommand
  extends AuthenticatedRepositoryCommand,
    DeleteEnvironment {
  environmentId: string;
}

export type DeleteEnvironmentResult =
  | { kind: "deleted" }
  | { kind: "conflict"; current: Environment }
  | { kind: "forbidden" }
  | { kind: "not-found" };

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
  | { kind: "not-found" }
  | { kind: "duplicate" };

export interface DeleteEnvironmentVariableCommand
  extends AuthenticatedRepositoryCommand,
    DeleteEnvironmentVariable {
  variableId: string;
}

export type DeleteVariableResult =
  | { kind: "deleted" }
  | { kind: "conflict"; current: EnvironmentVariable }
  | { kind: "forbidden" }
  | { kind: "not-found" };

export interface EnvironmentRepository {
  list(command: WorkspaceEnvironmentCommand): Promise<Environment[]>;
  create(command: CreateEnvironmentCommand): Promise<Environment | null>;
  update(command: UpdateEnvironmentCommand): Promise<UpdateEnvironmentResult>;
  remove(command: DeleteEnvironmentCommand): Promise<DeleteEnvironmentResult>;
  createVariable(
    command: CreateEnvironmentVariableCommand,
  ): Promise<CreateVariableResult>;
  updateVariable(
    command: UpdateEnvironmentVariableCommand,
  ): Promise<UpdateVariableResult>;
  removeVariable(
    command: DeleteEnvironmentVariableCommand,
  ): Promise<DeleteVariableResult>;
}
