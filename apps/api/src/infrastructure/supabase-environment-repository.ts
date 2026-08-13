import {
  environmentSchema,
  environmentVariableSchema,
  type Environment,
} from "@api-client/contracts";
import { z } from "zod";

import type {
  CreateEnvironmentCommand,
  CreateEnvironmentVariableCommand,
  CreateVariableResult,
  DeleteEnvironmentCommand,
  DeleteEnvironmentResult,
  DeleteEnvironmentVariableCommand,
  DeleteVariableResult,
  EnvironmentRepository,
  UpdateEnvironmentCommand,
  UpdateEnvironmentResult,
  UpdateEnvironmentVariableCommand,
  UpdateVariableResult,
  WorkspaceEnvironmentCommand,
} from "../domain/environment-repository.js";
import { createUserSupabaseClient } from "./supabase-user-client.js";

const environmentRowSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  name: z.string(),
  version: z.number().int(),
});

const variableRowSchema = z
  .object({
    id: z.string().uuid(),
    environment_id: z.string().uuid(),
    key: z.string(),
    value: z.string(),
    scope: z.string(),
    version: z.number().int(),
  })
  .transform((row) => ({
    id: row.id,
    environmentId: row.environment_id,
    key: row.key,
    value: row.value,
    scope: row.scope,
    version: row.version,
  }))
  .pipe(environmentVariableSchema);

export class SupabaseEnvironmentRepository
  implements EnvironmentRepository
{
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async list(command: WorkspaceEnvironmentCommand): Promise<Environment[]> {
    const client = this.client(command.accessToken);
    const environments = await client
      .from("environments")
      .select("id, workspace_id, name, version")
      .eq("workspace_id", command.workspaceId)
      .order("name");
    if (environments.error) {
      throw new Error("ENVIRONMENT_LIST_FAILED", {
        cause: environments.error,
      });
    }
    const rows = z.array(environmentRowSchema).parse(environments.data);
    if (rows.length === 0) return [];
    const variables = await client
      .from("environment_variables")
      .select("id, environment_id, key, value, scope, version")
      .in(
        "environment_id",
        rows.map(({ id }) => id),
      )
      .order("key");
    if (variables.error) {
      throw new Error("ENVIRONMENT_VARIABLE_LIST_FAILED", {
        cause: variables.error,
      });
    }
    const parsedVariables = z.array(variableRowSchema).parse(variables.data);
    return rows.map((row) =>
      environmentSchema.parse({
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        version: row.version,
        variables: parsedVariables.filter(
          ({ environmentId }) => environmentId === row.id,
        ),
      }),
    );
  }

  async create(
    command: CreateEnvironmentCommand,
  ): Promise<Environment | null> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("environments")
      .insert({
        workspace_id: command.workspaceId,
        name: command.name,
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select("id, workspace_id, name, version")
      .maybeSingle();
    if (error) {
      if (error.code === "42501") return null;
      throw new Error("ENVIRONMENT_CREATE_FAILED", { cause: error });
    }
    if (!data) return null;
    const row = environmentRowSchema.parse(data);
    return environmentSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      version: row.version,
      variables: [],
    });
  }

  async createVariable(
    command: CreateEnvironmentVariableCommand,
  ): Promise<CreateVariableResult> {
    const client = this.client(command.accessToken);
    const ownerUserId =
      command.scope === "personal" ? command.userId : null;
    const { data, error } = await client
      .from("environment_variables")
      .insert({
        environment_id: command.environmentId,
        key: command.key,
        value: command.value,
        scope: command.scope,
        owner_user_id: ownerUserId,
        created_by: command.userId,
        updated_by: command.userId,
      })
      .select("id, environment_id, key, value, scope, version")
      .maybeSingle();
    if (error) {
      if (error.code === "42501") return { kind: "forbidden" };
      if (error.code === "23505") return { kind: "duplicate" };
      throw new Error("ENVIRONMENT_VARIABLE_CREATE_FAILED", {
        cause: error,
      });
    }
    if (!data) return { kind: "forbidden" };
    return { kind: "created", variable: variableRowSchema.parse(data) };
  }

  async updateVariable(
    command: UpdateEnvironmentVariableCommand,
  ): Promise<UpdateVariableResult> {
    const client = this.client(command.accessToken);
    const changes: Record<string, unknown> = {
      version: command.expectedVersion + 1,
      updated_by: command.userId,
      updated_at: new Date().toISOString(),
    };
    if (command.key !== undefined) changes.key = command.key;
    if (command.value !== undefined) changes.value = command.value;
    const { data, error } = await client
      .from("environment_variables")
      .update(changes)
      .eq("id", command.variableId)
      .eq("version", command.expectedVersion)
      .select("id, environment_id, key, value, scope, version")
      .maybeSingle();
    if (!error && data) {
      return { kind: "updated", variable: variableRowSchema.parse(data) };
    }
    if (error?.code === "23505") return { kind: "duplicate" };
    if (error && error.code !== "42501") {
      throw new Error("ENVIRONMENT_VARIABLE_UPDATE_FAILED", {
        cause: error,
      });
    }
    const current = await client
      .from("environment_variables")
      .select("id, environment_id, key, value, scope, version")
      .eq("id", command.variableId)
      .maybeSingle();
    if (current.error) {
      throw new Error("ENVIRONMENT_VARIABLE_READ_FAILED", {
        cause: current.error,
      });
    }
    if (!current.data) return { kind: "not-found" };
    const variable = variableRowSchema.parse(current.data);
    return variable.version === command.expectedVersion
      ? { kind: "forbidden" }
      : { kind: "conflict", current: variable };
  }

  async removeVariable(
    command: DeleteEnvironmentVariableCommand,
  ): Promise<DeleteVariableResult> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("environment_variables")
      .delete()
      .eq("id", command.variableId)
      .eq("version", command.expectedVersion)
      .select("id, environment_id, key, value, scope, version")
      .maybeSingle();
    if (error) {
      throw new Error("ENVIRONMENT_VARIABLE_DELETE_FAILED", { cause: error });
    }
    if (data) return { kind: "deleted" };
    const current = await client
      .from("environment_variables")
      .select("id, environment_id, key, value, scope, version")
      .eq("id", command.variableId)
      .maybeSingle();
    if (current.error) {
      throw new Error("ENVIRONMENT_VARIABLE_READ_FAILED", {
        cause: current.error,
      });
    }
    if (!current.data) return { kind: "not-found" };
    const variable = variableRowSchema.parse(current.data);
    return variable.version === command.expectedVersion
      ? { kind: "forbidden" }
      : { kind: "conflict", current: variable };
  }

  async update(
    command: UpdateEnvironmentCommand,
  ): Promise<UpdateEnvironmentResult> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("environments")
      .update({
        name: command.name,
        version: command.expectedVersion + 1,
        updated_by: command.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", command.environmentId)
      .eq("version", command.expectedVersion)
      .select("id, workspace_id, name, version")
      .maybeSingle();
    if (!error && data) {
      const row = environmentRowSchema.parse(data);
      return {
        kind: "updated",
        environment: await this.buildEnvironment(client, row),
      };
    }
    if (error?.code === "23505") return { kind: "duplicate" };
    if (error && error.code !== "42501") {
      throw new Error("ENVIRONMENT_UPDATE_FAILED", { cause: error });
    }
    const current = await this.findEnvironment(client, command.environmentId);
    if (!current) return { kind: "not-found" };
    return current.version === command.expectedVersion
      ? { kind: "forbidden" }
      : { kind: "conflict", current };
  }

  async remove(
    command: DeleteEnvironmentCommand,
  ): Promise<DeleteEnvironmentResult> {
    const client = this.client(command.accessToken);
    const { data, error } = await client
      .from("environments")
      .delete()
      .eq("id", command.environmentId)
      .eq("version", command.expectedVersion)
      .select("id")
      .maybeSingle();
    if (error) {
      throw new Error("ENVIRONMENT_DELETE_FAILED", { cause: error });
    }
    if (data) return { kind: "deleted" };
    const current = await this.findEnvironment(client, command.environmentId);
    if (!current) return { kind: "not-found" };
    return current.version === command.expectedVersion
      ? { kind: "forbidden" }
      : { kind: "conflict", current };
  }

  private async fetchVariables(
    client: ReturnType<typeof createUserSupabaseClient>,
    environmentId: string,
  ) {
    const { data, error } = await client
      .from("environment_variables")
      .select("id, environment_id, key, value, scope, version")
      .eq("environment_id", environmentId)
      .order("key");
    if (error) {
      throw new Error("ENVIRONMENT_VARIABLE_LIST_FAILED", { cause: error });
    }
    return z.array(variableRowSchema).parse(data);
  }

  private async buildEnvironment(
    client: ReturnType<typeof createUserSupabaseClient>,
    row: z.infer<typeof environmentRowSchema>,
  ): Promise<Environment> {
    return environmentSchema.parse({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      version: row.version,
      variables: await this.fetchVariables(client, row.id),
    });
  }

  private async findEnvironment(
    client: ReturnType<typeof createUserSupabaseClient>,
    environmentId: string,
  ): Promise<Environment | null> {
    const { data, error } = await client
      .from("environments")
      .select("id, workspace_id, name, version")
      .eq("id", environmentId)
      .maybeSingle();
    if (error) {
      throw new Error("ENVIRONMENT_READ_FAILED", { cause: error });
    }
    if (!data) return null;
    return this.buildEnvironment(client, environmentRowSchema.parse(data));
  }

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}
