import { describe, expect, it } from "vitest";

import { InMemoryExecutionLimiter } from "./execution-limiter.js";

const key = { userId: "user-1", workspaceId: "workspace-1" };

describe("InMemoryExecutionLimiter", () => {
  it("rejects excessive requests until the rolling window expires", () => {
    let now = 1_000;
    const limiter = new InMemoryExecutionLimiter({
      windowMs: 60_000,
      maxPerUserPerWindow: 2,
      maxPerWorkspacePerWindow: 10,
      maxConcurrentPerUser: 2,
      maxConcurrentPerWorkspace: 10,
      now: () => now,
    });

    const first = limiter.acquire(key);
    const second = limiter.acquire(key);
    if (first.kind === "accepted") first.release();
    if (second.kind === "accepted") second.release();

    expect(limiter.acquire(key)).toMatchObject({
      kind: "rejected",
      reason: "rate",
      retryAfterMs: 60_000,
    });
    now += 60_001;
    expect(limiter.acquire(key).kind).toBe("accepted");
  });

  it("limits concurrent executions and releases capacity idempotently", () => {
    const limiter = new InMemoryExecutionLimiter({
      windowMs: 60_000,
      maxPerUserPerWindow: 10,
      maxPerWorkspacePerWindow: 10,
      maxConcurrentPerUser: 1,
      maxConcurrentPerWorkspace: 10,
    });
    const first = limiter.acquire(key);
    expect(first.kind).toBe("accepted");
    expect(limiter.acquire(key)).toMatchObject({
      kind: "rejected",
      reason: "concurrency",
    });
    if (first.kind === "accepted") {
      first.release();
      first.release();
    }
    expect(limiter.acquire(key).kind).toBe("accepted");
  });

  it("enforces workspace limits across different users", () => {
    const limiter = new InMemoryExecutionLimiter({
      windowMs: 60_000,
      maxPerUserPerWindow: 10,
      maxPerWorkspacePerWindow: 1,
      maxConcurrentPerUser: 10,
      maxConcurrentPerWorkspace: 10,
    });
    const first = limiter.acquire(key);
    if (first.kind === "accepted") first.release();
    expect(
      limiter.acquire({ userId: "user-2", workspaceId: key.workspaceId }),
    ).toMatchObject({ kind: "rejected", reason: "rate" });
  });
});
