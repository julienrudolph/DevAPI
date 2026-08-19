import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../auth/auth-context";
import {
  usePendingInvitations,
  useRevokeInvitation,
} from "../invitations/invitation-queries";
import {
  useRemoveTeamMember,
  useTeamMembers,
  useTransferTeamOwnership,
  useUpdateTeamMember,
} from "./team-member-queries";
import { TeamMembersDialog } from "./team-members-dialog";

vi.mock("../auth/auth-context", () => ({
  useAuth: vi.fn(),
}));
vi.mock("./team-member-queries", () => ({
  useTeamMembers: vi.fn(),
  useUpdateTeamMember: vi.fn(),
  useRemoveTeamMember: vi.fn(),
  useTransferTeamOwnership: vi.fn(),
}));
vi.mock("../invitations/invitation-queries", () => ({
  usePendingInvitations: vi.fn(),
  useRevokeInvitation: vi.fn(),
}));

function mockNoPendingInvitations() {
  vi.mocked(usePendingInvitations).mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof usePendingInvitations>);
  vi.mocked(useRevokeInvitation).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useRevokeInvitation>);
}

afterEach(cleanup);

describe("TeamMembersDialog", () => {
  it("protects the owner while allowing invited members to be managed", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "4776ac0f-28ba-474a-ad0d-d566be4199e8" },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTeamMembers).mockReturnValue({
      data: [
        {
          userId: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
          email: "owner@example.com",
          displayName: "Owner",
          role: "owner",
          joinedAt: "2026-07-30T08:00:00.000Z",
        },
        {
          userId: "db181f7c-ef66-4274-b464-a11ec7814c92",
          email: "ada@example.com",
          displayName: "Ada",
          role: "editor",
          joinedAt: "2026-07-30T09:00:00.000Z",
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamMembers>);
    vi.mocked(useUpdateTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpdateTeamMember>);
    vi.mocked(useRemoveTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useRemoveTeamMember>);
    vi.mocked(useTransferTeamOwnership).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTransferTeamOwnership>);
    mockNoPendingInvitations();

    render(
      <TeamMembersDialog
        onClose={vi.fn()}
        teamId="76a26d02-fc07-4cd7-9b6a-1e2c15fc127b"
      />,
    );

    expect(screen.getAllByText("Owner")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Owner entfernen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Rolle von Ada" }),
    ).toHaveValue("editor");
    expect(
      screen.getByRole("button", { name: "Ada entfernen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Owner-Rechte an Ada übertragen",
      }),
    ).toBeInTheDocument();
  });

  it("hides management actions for the acting user's own row once demoted", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "db181f7c-ef66-4274-b464-a11ec7814c92" },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTeamMembers).mockReturnValue({
      data: [
        {
          userId: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
          email: "owner@example.com",
          displayName: "Owner",
          role: "owner",
          joinedAt: "2026-07-30T08:00:00.000Z",
        },
        {
          userId: "db181f7c-ef66-4274-b464-a11ec7814c92",
          email: "ada@example.com",
          displayName: "Ada",
          role: "editor",
          joinedAt: "2026-07-30T09:00:00.000Z",
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamMembers>);
    vi.mocked(useUpdateTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpdateTeamMember>);
    vi.mocked(useRemoveTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useRemoveTeamMember>);
    vi.mocked(useTransferTeamOwnership).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTransferTeamOwnership>);
    mockNoPendingInvitations();

    render(
      <TeamMembersDialog
        onClose={vi.fn()}
        teamId="76a26d02-fc07-4cd7-9b6a-1e2c15fc127b"
      />,
    );

    expect(screen.getByText("Du")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ada entfernen" }),
    ).not.toBeInTheDocument();
  });

  it("lists a pending invitation with its expiry and revokes it", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "4776ac0f-28ba-474a-ad0d-d566be4199e8" },
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTeamMembers).mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTeamMembers>);
    vi.mocked(useUpdateTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useUpdateTeamMember>);
    vi.mocked(useRemoveTeamMember).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useRemoveTeamMember>);
    vi.mocked(useTransferTeamOwnership).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useTransferTeamOwnership>);
    vi.mocked(usePendingInvitations).mockReturnValue({
      data: [
        {
          id: "95da6097-0742-4164-9c9a-75dc64d2cd8f",
          teamId: "76a26d02-fc07-4cd7-9b6a-1e2c15fc127b",
          role: "editor",
          createdAt: "2026-08-01T12:00:00.000Z",
          expiresAt: "2026-08-08T12:00:00.000Z",
          createdBy: {
            id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
            displayName: "Owner",
          },
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof usePendingInvitations>);
    const revoke = vi.fn();
    vi.mocked(useRevokeInvitation).mockReturnValue({
      mutate: revoke,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useRevokeInvitation>);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    render(
      <TeamMembersDialog
        onClose={vi.fn()}
        teamId="76a26d02-fc07-4cd7-9b6a-1e2c15fc127b"
      />,
    );

    expect(screen.getByText("erstellt von Owner", { exact: false })).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Einladung widerrufen" }),
    );
    expect(revoke).toHaveBeenCalledWith(
      "95da6097-0742-4164-9c9a-75dc64d2cd8f",
    );
  });
});
