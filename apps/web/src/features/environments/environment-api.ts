import {
  createEnvironmentSchema,
  environmentSchema,
  environmentVariableSchema,
  upsertEnvironmentVariableSchema,
  type CreateEnvironment,
  type Environment,
  type EnvironmentVariable,
  type UpsertEnvironmentVariable,
} from "@api-client/contracts";
import { z } from "zod";

export async function fetchEnvironments(
  workspaceId: string,
  accessToken: string,
): Promise<Environment[]> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/environments`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) throw new Error(`ENVIRONMENT_LIST_${response.status}`);
  return z.array(environmentSchema).parse(await response.json());
}

export async function createEnvironment(
  workspaceId: string,
  input: CreateEnvironment,
  accessToken: string,
): Promise<Environment> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/environments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createEnvironmentSchema.parse(input)),
    },
  );
  if (!response.ok) throw new Error(`ENVIRONMENT_CREATE_${response.status}`);
  return environmentSchema.parse(await response.json());
}

export async function createEnvironmentVariable(
  environmentId: string,
  input: UpsertEnvironmentVariable,
  accessToken: string,
): Promise<EnvironmentVariable> {
  const response = await fetch(
    `/api/v1/environments/${environmentId}/variables`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upsertEnvironmentVariableSchema.parse(input)),
    },
  );
  if (!response.ok) {
    throw new Error(`ENVIRONMENT_VARIABLE_CREATE_${response.status}`);
  }
  return environmentVariableSchema.parse(await response.json());
}
