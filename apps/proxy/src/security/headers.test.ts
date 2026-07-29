import { describe, expect, it } from "vitest";

import {
  sanitizeRequestHeaders,
  sanitizeResponseHeaders,
  UnsafeHeaderError,
} from "./headers.js";

describe("header safety", () => {
  it("blocks transport-controlled and injected request headers", () => {
    expect(() =>
      sanitizeRequestHeaders([
        { key: "Host", value: "internal", enabled: true },
      ]),
    ).toThrow(UnsafeHeaderError);
    expect(() =>
      sanitizeRequestHeaders([
        { key: "X-Test", value: "ok\r\nX-Injected: yes", enabled: true },
      ]),
    ).toThrow(UnsafeHeaderError);
  });

  it("omits sensitive response headers", () => {
    expect(
      sanitizeResponseHeaders({
        "content-type": "application/json",
        "set-cookie": ["session=secret"],
      }),
    ).toEqual({ "content-type": "application/json" });
  });
});
