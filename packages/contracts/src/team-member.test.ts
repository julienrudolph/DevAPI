import { describe, expect, it } from "vitest";

import {
  teamMemberSchema,
  transferTeamOwnershipSchema,
  updateTeamMemberSchema,
} from "./team-member";

describe("team member contracts", () => {
  it("accepts only manageable target roles", () => {
    expect(updateTeamMemberSchema.parse({ role: "viewer" })).toEqual({
      role: "viewer",
    });
    expect(() => updateTeamMemberSchema.parse({ role: "owner" })).toThrow();
  });

  it("validates member identity at the API boundary", () => {
    expect(() =>
      teamMemberSchema.parse({
        userId: crypto.randomUUID(),
        email: "invalid",
        displayName: "Ada",
        role: "editor",
        joinedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it("requires a valid user id for ownership transfer", () => {
    const userId = crypto.randomUUID();
    expect(
      transferTeamOwnershipSchema.parse({ newOwnerUserId: userId }),
    ).toEqual({ newOwnerUserId: userId });
    expect(() =>
      transferTeamOwnershipSchema.parse({ newOwnerUserId: "not-a-uuid" }),
    ).toThrow();
  });
});
