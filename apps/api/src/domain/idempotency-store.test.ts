import { describe, expect, it } from "vitest";

import {
  idempotencyKeyFromHeader,
  InMemoryIdempotencyStore,
} from "./idempotency-store.js";

describe("InMemoryIdempotencyStore", () => {
  it("returns a cached response for a repeated key", () => {
    const store = new InMemoryIdempotencyStore({ ttlMs: 60_000 });
    store.set("user:route:key-1", { status: 200, body: { ok: true } });

    expect(store.get("user:route:key-1")).toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  it("expires an entry once its TTL elapses", () => {
    let now = 0;
    const store = new InMemoryIdempotencyStore({
      ttlMs: 1_000,
      now: () => now,
    });
    store.set("user:route:key-1", { status: 200, body: {} });

    now = 1_001;
    expect(store.get("user:route:key-1")).toBeUndefined();
  });

  it("treats each composite key independently", () => {
    const store = new InMemoryIdempotencyStore({ ttlMs: 60_000 });
    store.set("user-a:execute:key-1", { status: 200, body: "a" });

    expect(store.get("user-b:execute:key-1")).toBeUndefined();
    expect(store.get("user-a:invitations:key-1")).toBeUndefined();
    expect(store.get("user-a:execute:key-1")).toEqual({
      status: 200,
      body: "a",
    });
  });

  it("evicts expired entries once the store is full", () => {
    let now = 0;
    const store = new InMemoryIdempotencyStore({
      ttlMs: 1_000,
      maxEntries: 2,
      now: () => now,
    });
    store.set("key-1", { status: 200, body: 1 });
    now = 2_000;
    store.set("key-2", { status: 200, body: 2 });
    // key-1 has expired by now; inserting a third entry should sweep it
    // instead of the store growing past maxEntries.
    store.set("key-3", { status: 200, body: 3 });

    expect(store.get("key-1")).toBeUndefined();
    expect(store.get("key-2")).toEqual({ status: 200, body: 2 });
    expect(store.get("key-3")).toEqual({ status: 200, body: 3 });
  });
});

describe("idempotencyKeyFromHeader", () => {
  it("trims a valid header value", () => {
    expect(idempotencyKeyFromHeader("  abc-123  ")).toBe("abc-123");
  });

  it("uses the first value of a duplicated header", () => {
    expect(idempotencyKeyFromHeader(["first", "second"])).toBe("first");
  });

  it("rejects missing, empty, or excessively long values", () => {
    expect(idempotencyKeyFromHeader(undefined)).toBeUndefined();
    expect(idempotencyKeyFromHeader("   ")).toBeUndefined();
    expect(idempotencyKeyFromHeader("a".repeat(201))).toBeUndefined();
  });
});
