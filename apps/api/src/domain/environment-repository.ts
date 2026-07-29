import type {
  CreateEnvironment,
  Environment,
  EnvironmentVariable,
  UpsertEnvironmentVariable,
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

export interface EnvironmentRepository {
  list(command: WorkspaceEnvironmentCommand): Promise<Environment[]>;
  create(command: CreateEnvironmentCommand): Promise<Environment | null>;
  createVariable(
    command: CreateEnvironmentVariableCommand,
  ): Promise<CreateVariableResult>;
}
