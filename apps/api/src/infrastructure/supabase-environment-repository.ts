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
  EnvironmentRepository,
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

  private client(accessToken: string) {
    return createUserSupabaseClient(
      this.supabaseUrl,
      this.publishableKey,
      accessToken,
    );
  }
}
