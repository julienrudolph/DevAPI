import { describe, expect, it } from "vitest";

import { readAuthConfirmation } from "./auth-confirm-page";

describe("readAuthConfirmation", () => {
  it("liest einen gültigen E-Mail-Token", () => {
    expect(
      readAuthConfirmation(
        new URLSearchParams("token_hash=hashed-token&type=email"),
      ),
    ).toEqual({
      tokenHash: "hashed-token",
      type: "email",
    });
  });

  it.each([
    "",
    "type=email",
    "token_hash=hashed-token",
    "token_hash=hashed-token&type=magiclink",
  ])("weist unvollständige oder unerwartete Parameter zurück: %s", (query) => {
    expect(readAuthConfirmation(new URLSearchParams(query))).toBeNull();
  });
});
