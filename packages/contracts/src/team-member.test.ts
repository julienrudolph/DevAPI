import { describe, expect, it } from "vitest";

import {
  teamMemberSchema,
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
});
