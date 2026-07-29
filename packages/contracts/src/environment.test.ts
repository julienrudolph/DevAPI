import { describe, expect, it } from "vitest";

import {
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
});
