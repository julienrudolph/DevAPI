import {
  createEnvironmentSchema,
  deleteEnvironmentSchema,
  deleteEnvironmentVariableSchema,
  environmentConflictSchema,
  environmentSchema,
  environmentVariableConflictSchema,
  environmentVariableSchema,
  updateEnvironmentSchema,
  updateEnvironmentVariableSchema,
  upsertEnvironmentVariableSchema,
  type CreateEnvironment,
  type DeleteEnvironment,
  type DeleteEnvironmentVariable,
  type Environment,
  type EnvironmentConflict,
  type EnvironmentVariable,
  type EnvironmentVariableConflict,
  type UpdateEnvironment,
  type UpdateEnvironmentVariable,
  type UpsertEnvironmentVariable,
} from "@api-client/contracts";
import { z } from "zod";

export class EnvironmentVariableConflictError extends Error {
  constructor(readonly conflict: EnvironmentVariableConflict) {
    super("ENVIRONMENT_VARIABLE_VERSION_CONFLICT");
  }
}

export class EnvironmentConflictError extends Error {
  constructor(readonly conflict: EnvironmentConflict) {
    super("ENVIRONMENT_VERSION_CONFLICT");
  }
}

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

export async function updateEnvironmentVariable(
  variableId: string,
  input: UpdateEnvironmentVariable,
  accessToken: string,
): Promise<EnvironmentVariable> {
  const response = await fetch(
    `/api/v1/environment-variables/${variableId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateEnvironmentVariableSchema.parse(input)),
    },
  );
  if (response.status === 409) {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      body.code === "ENVIRONMENT_VARIABLE_VERSION_CONFLICT"
    ) {
      throw new EnvironmentVariableConflictError(
        environmentVariableConflictSchema.parse(body),
      );
    }
    throw new Error("ENVIRONMENT_VARIABLE_UPDATE_409");
  }
  if (!response.ok) {
    throw new Error(`ENVIRONMENT_VARIABLE_UPDATE_${response.status}`);
  }
  return environmentVariableSchema.parse(await response.json());
}

export async function deleteEnvironmentVariable(
  variableId: string,
  input: DeleteEnvironmentVariable,
  accessToken: string,
): Promise<void> {
  const response = await fetch(
    `/api/v1/environment-variables/${variableId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deleteEnvironmentVariableSchema.parse(input)),
    },
  );
  if (response.status === 409) {
    throw new EnvironmentVariableConflictError(
      environmentVariableConflictSchema.parse(await response.json()),
    );
  }
  if (!response.ok) {
    throw new Error(`ENVIRONMENT_VARIABLE_DELETE_${response.status}`);
  }
}

export async function updateEnvironment(
  environmentId: string,
  input: UpdateEnvironment,
  accessToken: string,
): Promise<Environment> {
  const response = await fetch(`/api/v1/environments/${environmentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateEnvironmentSchema.parse(input)),
  });
  if (response.status === 409) {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      body.code === "ENVIRONMENT_VERSION_CONFLICT"
    ) {
      throw new EnvironmentConflictError(environmentConflictSchema.parse(body));
    }
    throw new Error("ENVIRONMENT_UPDATE_409");
  }
  if (!response.ok) {
    throw new Error(`ENVIRONMENT_UPDATE_${response.status}`);
  }
  return environmentSchema.parse(await response.json());
}

export async function deleteEnvironment(
  environmentId: string,
  input: DeleteEnvironment,
  accessToken: string,
): Promise<void> {
  const response = await fetch(`/api/v1/environments/${environmentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deleteEnvironmentSchema.parse(input)),
  });
  if (response.status === 409) {
    throw new EnvironmentConflictError(
      environmentConflictSchema.parse(await response.json()),
    );
  }
  if (!response.ok) {
    throw new Error(`ENVIRONMENT_DELETE_${response.status}`);
  }
}
