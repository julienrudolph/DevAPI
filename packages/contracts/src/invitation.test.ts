import { describe, expect, it } from "vitest";

import {
  acceptTeamInvitationSchema,
  createTeamInvitationSchema,
  teamInvitationSchema,
} from "./invitation";

describe("invitation contracts", () => {
  it("limits assignable roles to editor and viewer", () => {
    expect(createTeamInvitationSchema.parse({ role: "editor" })).toEqual({
      role: "editor",
    });
    expect(() =>
      createTeamInvitationSchema.parse({ role: "owner" }),
    ).toThrow();
  });

  it("rejects tokens too short to provide sufficient entropy", () => {
    expect(() => acceptTeamInvitationSchema.parse({ token: "short" })).toThrow();
    expect(
      acceptTeamInvitationSchema.parse({ token: "a".repeat(64) }),
    ).toEqual({ token: "a".repeat(64) });
  });

  it("requires a bounded, expiring invitation response", () => {
    expect(() =>
      teamInvitationSchema.parse({
        id: crypto.randomUUID(),
        teamId: crypto.randomUUID(),
        role: "viewer",
        token: "a".repeat(64),
        expiresAt: "never",
      }),
    ).toThrow();
  });
});
