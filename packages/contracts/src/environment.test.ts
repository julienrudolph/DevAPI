import { describe, expect, it } from "vitest";

import {
  environmentVariableConflictSchema,
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
});
