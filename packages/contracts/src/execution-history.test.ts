import { describe, expect, it } from "vitest";

import {
  executeSavedRequestSchema,
  requestExecutionSchema,
} from "./execution-history";

describe("execution history contracts", () => {
  it("requires execution to reference a persisted request", () => {
    expect(() =>
      executeSavedRequestSchema.parse({
        method: "GET",
        url: "https://api.example.com",
        headers: [],
      }),
    ).toThrow();
  });

  it("does not expose sensitive request or response content", () => {
    const parsed = requestExecutionSchema.parse({
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      requestName: "Health",
      method: "GET",
      statusCode: 200,
      durationMs: 14,
      successful: true,
      executedBy: {
        id: crypto.randomUUID(),
        displayName: "Ada",
      },
      executedAt: new Date().toISOString(),
      url: "https://secret.example.com?token=secret",
      responseBody: "secret",
    });
    expect(parsed).not.toHaveProperty("url");
    expect(parsed).not.toHaveProperty("responseBody");
  });
});
