import { describe, expect, it } from "vitest";

import { extractBearerToken } from "./authenticator.js";

describe("bearer token parsing", () => {
  it("extracts a non-empty bearer token", () => {
    expect(extractBearerToken("Bearer signed-token")).toBe("signed-token");
  });

  it.each([undefined, "", "Basic abc", "Bearer ", "bearer token"])(
    "rejects invalid authorization value %s",
    (value) => {
      expect(extractBearerToken(value)).toBeNull();
    },
  );
});
