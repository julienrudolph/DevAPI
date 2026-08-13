import { describe, expect, it } from "vitest";

import {
  resolveJsonPath,
  stringifyExtractedValue,
  tryParseJson,
} from "./json-path";

const body = {
  token: "abc123",
  data: {
    items: [{ id: "one" }, { id: "two" }],
  },
  count: 2,
  nested: null,
};

describe("resolveJsonPath", () => {
  it("resolves a top-level key", () => {
    expect(resolveJsonPath(body, "token")).toEqual({
      found: true,
      value: "abc123",
    });
  });

  it("resolves nested keys and array indices in both notations", () => {
    expect(resolveJsonPath(body, "data.items.1.id")).toEqual({
      found: true,
      value: "two",
    });
    expect(resolveJsonPath(body, "data.items[1].id")).toEqual({
      found: true,
      value: "two",
    });
  });

  it("reports not found for a missing key, out-of-range index or null hop", () => {
    expect(resolveJsonPath(body, "missing")).toEqual({ found: false });
    expect(resolveJsonPath(body, "data.items.5")).toEqual({ found: false });
    expect(resolveJsonPath(body, "nested.anything")).toEqual({
      found: false,
    });
    expect(resolveJsonPath(body, "")).toEqual({ found: false });
  });
});

describe("tryParseJson", () => {
  it("parses valid JSON and returns undefined for invalid input", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("not json")).toBeUndefined();
  });
});

describe("stringifyExtractedValue", () => {
  it("keeps strings as-is and JSON-encodes everything else", () => {
    expect(stringifyExtractedValue("hello")).toBe("hello");
    expect(stringifyExtractedValue(2)).toBe("2");
    expect(stringifyExtractedValue({ a: 1 })).toBe('{"a":1}');
    expect(stringifyExtractedValue(undefined)).toBe("");
  });
});
