import { describe, expect, it } from "vitest";

import { evaluateAssertions } from "./assertions";

describe("evaluateAssertions", () => {
  it("checks status codes with equals and notEquals", () => {
    const results = evaluateAssertions(
      [
        {
          id: "a1",
          type: "status",
          operator: "equals",
          expected: 200,
        },
        {
          id: "a2",
          type: "status",
          operator: "notEquals",
          expected: 500,
        },
      ],
      { status: 200, body: "{}" },
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("fails a status assertion when the code does not match", () => {
    const results = evaluateAssertions(
      [{ id: "a1", type: "status", operator: "equals", expected: 200 }],
      { status: 404, body: "{}" },
    );
    expect(results[0]!.passed).toBe(false);
  });

  it("checks JSON path existence and equality", () => {
    const body = JSON.stringify({ data: { token: "abc123" } });
    const results = evaluateAssertions(
      [
        { id: "a1", type: "jsonPath", path: "data.token", operator: "exists" },
        {
          id: "a2",
          type: "jsonPath",
          path: "data.token",
          operator: "equals",
          expected: "abc123",
        },
        {
          id: "a3",
          type: "jsonPath",
          path: "data.missing",
          operator: "notExists",
        },
      ],
      { status: 200, body },
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("fails jsonPath assertions when the body is not valid JSON", () => {
    const results = evaluateAssertions(
      [{ id: "a1", type: "jsonPath", path: "token", operator: "exists" }],
      { status: 200, body: "not json" },
    );
    expect(results[0]!.passed).toBe(false);
  });

  it("checks contains against a stringified value", () => {
    const body = JSON.stringify({ message: "hello world" });
    const results = evaluateAssertions(
      [
        {
          id: "a1",
          type: "jsonPath",
          path: "message",
          operator: "contains",
          expected: "world",
        },
      ],
      { status: 200, body },
    );
    expect(results[0]!.passed).toBe(true);
  });
});
