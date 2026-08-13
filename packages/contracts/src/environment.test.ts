import { describe, expect, it } from "vitest";

import {
  environmentConflictSchema,
  environmentVariableConflictSchema,
  updateEnvironmentSchema,
  updateEnvironmentVariableSchema,
  upsertEnvironmentVariableSchema,
  variableKeySchema,
} from "./environment.js";

describe("environment variable contracts", () => {
  it("accepts portable variable names and rejects template syntax", () => {
    expect(variableKeySchema.safeParse("baseUrl").success).toBe(true);
    expect(variableKeySchema.safeParse("service.api-url").success).toBe(true);
    expect(variableKeySchema.safeParse("{{baseUrl}}").success).toBe(false);
  });

  it("requires an explicit shared or personal scope", () => {
    expect(
      upsertEnvironmentVariableSchema.safeParse({
        key: "token",
        value: "secret",
        scope: "personal",
      }).success,
    ).toBe(true);
  });

  it("validates version conflicts with the current visible value", () => {
    expect(
      environmentVariableConflictSchema.safeParse({
        code: "ENVIRONMENT_VARIABLE_VERSION_CONFLICT",
        message: "Konflikt",
        expectedVersion: 1,
        currentVersion: 2,
        current: {
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
          key: "baseUrl",
          value: "https://new.example.com",
          scope: "shared",
          version: 2,
        },
      }).success,
    ).toBe(true);
  });

  it("validates environment version conflicts", () => {
    expect(
      environmentConflictSchema.safeParse({
        code: "ENVIRONMENT_VERSION_CONFLICT",
        message: "Konflikt",
        expectedVersion: 1,
        currentVersion: 2,
        current: {
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          workspaceId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
          name: "Dev",
          version: 2,
          variables: [],
        },
      }).success,
    ).toBe(true);
  });

  it("requires a name and expected version to rename an environment", () => {
    expect(
      updateEnvironmentSchema.safeParse({ name: "Dev", expectedVersion: 1 })
        .success,
    ).toBe(true);
    expect(
      updateEnvironmentSchema.safeParse({ name: "", expectedVersion: 1 })
        .success,
    ).toBe(false);
  });

  it("allows renaming a variable's key, its value, or both", () => {
    expect(
      updateEnvironmentVariableSchema.safeParse({
        key: "newKey",
        expectedVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      updateEnvironmentVariableSchema.safeParse({
        value: "new value",
        expectedVersion: 1,
      }).success,
    ).toBe(true);
    expect(
      updateEnvironmentVariableSchema.safeParse({ expectedVersion: 1 })
        .success,
    ).toBe(false);
  });
});
