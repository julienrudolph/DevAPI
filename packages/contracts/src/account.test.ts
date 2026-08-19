import { describe, expect, it } from "vitest";

import { deleteAccountSchema, soleOwnerTeamSchema } from "./account";

describe("account contracts", () => {
  it("requires a plausible email for the deletion confirmation", () => {
    expect(() =>
      deleteAccountSchema.parse({ confirmEmail: "not-an-email" }),
    ).toThrow();
    expect(
      deleteAccountSchema.parse({ confirmEmail: "ada@example.test" }),
    ).toEqual({ confirmEmail: "ada@example.test" });
  });

  it("describes a team blocking self-deletion by id and name", () => {
    expect(
      soleOwnerTeamSchema.parse({
        id: crypto.randomUUID(),
        name: "Solo Team",
      }),
    ).toMatchObject({ name: "Solo Team" });
  });
});
