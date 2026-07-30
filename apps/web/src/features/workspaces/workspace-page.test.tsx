import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

import {
  reorderRequestIds,
  WorkspacePage,
} from "./workspace-page";
import {
  useWorkspaces,
  useWorkspaceTree,
} from "./workspace-queries";
import { useEnvironments } from "../environments/environment-queries";

vi.mock("./workspace-queries", () => ({
  useWorkspaces: vi.fn(),
  useWorkspaceTree: vi.fn(),
}));
vi.mock("../environments/environment-queries", () => ({
  useEnvironments: vi.fn(),
}));
vi.mock("../requests/request-editor", () => ({
  RequestEditor: ({
    requestId,
    onDirtyChange,
  }: {
    requestId: string;
    onDirtyChange?: (dirty: boolean) => void;
  }) => (
    <input
      aria-label={`Entwurf ${requestId}`}
      onChange={() => onDirtyChange?.(true)}
    />
  ),
}));
vi.mock("../environments/environment-controls", () => ({
  EnvironmentControls: () => null,
}));
vi.mock("../invitations/invitation-dialog", () => ({
  InvitationDialog: () => null,
}));
vi.mock("../teams/team-members-dialog", () => ({
  TeamMembersDialog: () => null,
}));
vi.mock("../history/execution-history-dialog", () => ({
  ExecutionHistoryDialog: () => null,
}));
vi.mock("./collection-create-form", () => ({
  CollectionCreateForm: () => null,
}));
vi.mock("./navigation-create-form", () => ({
  FolderCreateForm: () => null,
  RequestCreateForm: () => null,
}));
vi.mock("./workspace-create-form", () => ({
  WorkspaceCreateForm: () => null,
}));

const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
const folderId = "e8f8b5cb-9d47-4265-b34a-599ed8ea8b21";
const firstRequestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
const secondRequestId = "a5acefdb-0b49-43d7-83dc-f3ec414aa501";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(useWorkspaces).mockReturnValue({
    data: [
      {
        id: workspaceId,
        teamId: "ca310ca9-7dd9-4c67-9e03-c73cb38ca475",
        name: "Platform Engineering",
        role: "editor",
      },
    ],
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useWorkspaces>);
  vi.mocked(useWorkspaceTree).mockReturnValue({
    data: {
      workspaceId,
      collections: [
        {
          id: collectionId,
          workspaceId,
          name: "Customers",
          position: 0,
          version: 1,
        },
      ],
      folders: [
        {
          id: folderId,
          workspaceId,
          collectionId,
          parentFolderId: null,
          name: "Mutations",
          position: 0,
        },
      ],
      requests: [
        {
          id: firstRequestId,
          workspaceId,
          collectionId,
          folderId: null,
          name: "List customers",
          method: "GET",
          version: 1,
        },
        {
          id: secondRequestId,
          workspaceId,
          collectionId,
          folderId,
          name: "Create customer",
          method: "POST",
          version: 1,
        },
      ],
    },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useWorkspaceTree>);
  vi.mocked(useEnvironments).mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useEnvironments>);
});

afterEach(cleanup);

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={[`/workspaces/${workspaceId}`]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspacePage", () => {
  it("collapses and expands collections", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const toggle = screen.getByRole("button", { name: "Customers" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "GET List customers" }),
    ).toBeVisible();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "GET List customers" }),
    ).not.toBeInTheDocument();
  });

  it("collapses and expands nested folders", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const toggle = screen.getByRole("button", { name: "Mutations" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "POST Create customer" }),
    ).toBeVisible();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "POST Create customer" }),
    ).not.toBeInTheDocument();
  });

  it("keeps unsaved drafts mounted while switching request tabs", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWorkspace();

    const firstDraft = await screen.findByLabelText(
      `Entwurf ${firstRequestId}`,
    );
    await user.type(firstDraft, "lokaler Entwurf");
    await user.click(
      screen.getByRole("button", { name: /Create customer/ }),
    );
    expect(confirm).not.toHaveBeenCalled();

    expect(
      screen.getByRole("tab", { name: /List customers/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Create customer/ }),
    ).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("tab", { name: /List customers/ }));

    expect(firstDraft).toHaveValue("lokaler Entwurf");

    await user.click(
      screen.getByRole("button", { name: "List customers schließen" }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("tab", { name: /List customers/ }),
    ).toBeInTheDocument();
  });

  it("restores open tabs, their order and the active tab after reload", async () => {
    const user = userEvent.setup();
    const firstRender = renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "POST Create customer" }),
    );
    await waitFor(() =>
      expect(localStorage.getItem(`devapi:workspace-tabs:${workspaceId}`))
        .toContain(secondRequestId),
    );
    firstRender.unmount();

    renderWorkspace();

    expect(
      await screen.findByRole("tab", { name: /Create customer/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tab")).toHaveLength(2);
  });

  it("closes other tabs and all tabs through the tab actions", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "POST Create customer" }),
    );
    await user.click(screen.getByLabelText("Tab-Aktionen"));
    await user.click(
      screen.getByRole("button", { name: "Andere Tabs schließen" }),
    );

    expect(screen.getAllByRole("tab")).toHaveLength(1);
    expect(
      screen.getByRole("tab", { name: /Create customer/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByLabelText("Tab-Aktionen"));
    await user.click(
      screen.getByRole("button", { name: "Alle Tabs schließen" }),
    );

    expect(
      screen.getByText("Kein Request ausgewählt"),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(localStorage.getItem(`devapi:workspace-tabs:${workspaceId}`))
        .toContain('"openRequestIds":[]'),
    );
    cleanup();
    renderWorkspace();
    expect(
      await screen.findByText("Kein Request ausgewählt"),
    ).toBeInTheDocument();
  });

  it("reorders request ids without dropping tabs", () => {
    expect(
      reorderRequestIds(
        [firstRequestId, secondRequestId],
        secondRequestId,
        firstRequestId,
      ),
    ).toEqual([secondRequestId, firstRequestId]);
  });
});
