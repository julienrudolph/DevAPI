import { describe, expect, it } from "vitest";

import {
  requestRevisionSchema,
  restoreRequestRevisionSchema,
} from "./revision";

describe("revision contracts", () => {
  it("exposes metadata without a request snapshot", () => {
    const revision = requestRevisionSchema.parse({
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      version: 2,
      name: "Health",
      method: "GET",
      changeType: "update",
      createdBy: { id: crypto.randomUUID(), displayName: "Ada" },
      createdAt: new Date().toISOString(),
      snapshot: { headers: [{ value: "secret" }] },
    });
    expect(revision).not.toHaveProperty("snapshot");
    expect(JSON.stringify(revision)).not.toContain("secret");
  });

  it("requires optimistic locking when restoring", () => {
    expect(() =>
      restoreRequestRevisionSchema.parse({
        revisionId: crypto.randomUUID(),
        expectedVersion: 0,
      }),
    ).toThrow();
  });
});
