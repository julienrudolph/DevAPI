import {
  cleanup,
  fireEvent,
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

const shortcutSubmission = vi.fn();
const deleteRequestMutation = vi.hoisted(() => vi.fn());
const deleteCollectionMutation = vi.hoisted(() => vi.fn());
const deleteFolderMutation = vi.hoisted(() => vi.fn());
const updateCollectionMutation = vi.hoisted(() => vi.fn());
const updateFolderMutation = vi.hoisted(() => vi.fn());
const moveRequestMutation = vi.hoisted(() => vi.fn());

vi.mock("./workspace-queries", () => ({
  useExportWorkspace: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useDeleteCollection: vi.fn(() => ({
    mutateAsync: deleteCollectionMutation,
    isPending: false,
  })),
  useDeleteFolder: vi.fn(() => ({
    mutateAsync: deleteFolderMutation,
    isPending: false,
  })),
  useUpdateCollection: vi.fn(() => ({
    mutateAsync: updateCollectionMutation,
    isPending: false,
  })),
  useUpdateFolder: vi.fn(() => ({
    mutateAsync: updateFolderMutation,
    isPending: false,
  })),
  useWorkspaces: vi.fn(),
  useWorkspaceTree: vi.fn(),
}));
vi.mock("../environments/environment-queries", () => ({
  useEnvironments: vi.fn(),
}));
vi.mock("../requests/request-editor", () => ({
  RequestEditor: ({
    formId,
    requestId,
    onDirtyChange,
  }: {
    formId: string;
    requestId: string;
    onDirtyChange?: (dirty: boolean) => void;
  }) => (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        shortcutSubmission(
          (event.nativeEvent as SubmitEvent).submitter instanceof
            HTMLButtonElement
            ? (
                (event.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement
              ).value
            : undefined,
        );
      }}
    >
      <input
        aria-label={`Entwurf ${requestId}`}
        onChange={() => onDirtyChange?.(true)}
      />
    </form>
  ),
}));
vi.mock("../requests/request-queries", () => ({
  useDeleteRequest: vi.fn(() => ({
    mutateAsync: deleteRequestMutation,
    isPending: false,
  })),
  useDuplicateRequest: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
  })),
  useMoveRequest: vi.fn(() => ({
    mutateAsync: moveRequestMutation,
    isPending: false,
  })),
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
  FolderCreateForm: ({ parentFolderId }: { parentFolderId?: string }) => (
    <form aria-label={`Ordner anlegen ${parentFolderId ?? "Collection"}`} />
  ),
  RequestCreateForm: ({ folderId }: { folderId?: string }) => (
    <form aria-label={`Request anlegen ${folderId ?? "Collection"}`} />
  ),
}));
vi.mock("./workspace-create-form", () => ({
  WorkspaceCreateForm: ({ teamId }: { teamId?: string }) => (
    <form aria-label="Workspace anlegen" data-team-id={teamId} />
  ),
}));

const workspaceId = "85e52968-22cc-483d-b6a6-bdc169e46ede";
const collectionId = "95da6097-0742-4164-9c9a-75dc64d2cd8f";
const secondCollectionId = "75b3525f-d1d4-4ef9-a2b6-b5f2ee9a8eb0";
const folderId = "e8f8b5cb-9d47-4265-b34a-599ed8ea8b21";
const secondFolderId = "3b55891d-b9c0-4c36-af89-587a77545a0a";
const firstRequestId = "fa7596b3-0041-4fe8-9ddf-956e7a107014";
const secondRequestId = "a5acefdb-0b49-43d7-83dc-f3ec414aa501";

beforeEach(() => {
  localStorage.clear();
  shortcutSubmission.mockReset();
  deleteRequestMutation.mockReset();
  deleteRequestMutation.mockResolvedValue(undefined);
  deleteCollectionMutation.mockReset();
  deleteCollectionMutation.mockResolvedValue(undefined);
  deleteFolderMutation.mockReset();
  deleteFolderMutation.mockResolvedValue(undefined);
  updateCollectionMutation.mockReset();
  updateCollectionMutation.mockResolvedValue(undefined);
  updateFolderMutation.mockReset();
  updateFolderMutation.mockResolvedValue(undefined);
  moveRequestMutation.mockReset();
  moveRequestMutation.mockResolvedValue(undefined);
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
        {
          id: secondCollectionId,
          workspaceId,
          name: "Internal",
          position: 1,
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
          version: 1,
        },
        {
          id: secondFolderId,
          workspaceId,
          collectionId,
          parentFolderId: null,
          name: "Queries",
          position: 1,
          version: 1,
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
          url: "https://api.example.com/customers",
          version: 1,
        },
        {
          id: secondRequestId,
          workspaceId,
          collectionId,
          folderId,
          name: "Create customer",
          method: "POST",
          url: "https://api.example.com/customers",
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
  it("switches workspaces and exposes creation after onboarding", async () => {
    const user = userEvent.setup();
    const secondWorkspaceId = "45d80ec6-6136-41d9-b62c-953e3fe94456";
    vi.mocked(useWorkspaces).mockReturnValue({
      data: [
        {
          id: workspaceId,
          teamId: "ca310ca9-7dd9-4c67-9e03-c73cb38ca475",
          name: "Platform Engineering",
          role: "editor",
        },
        {
          id: secondWorkspaceId,
          teamId: "43cf6729-5634-43b7-8510-6164a1d6ef46",
          name: "Customer API",
          role: "owner",
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useWorkspaces>);
    renderWorkspace();

    await user.selectOptions(
      screen.getByLabelText("Workspace auswählen"),
      secondWorkspaceId,
    );
    expect(
      screen.getByLabelText("Workspace auswählen"),
    ).toHaveValue(secondWorkspaceId);

    await user.click(
      screen.getByRole("button", { name: "Workspace erstellen" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Workspace erstellen" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Workspace anlegen")).toHaveAttribute(
      "data-team-id",
      "43cf6729-5634-43b7-8510-6164a1d6ef46",
    );
  });

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

  it("deletes empty collections and folders only after confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "Customers Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Customers löschen" }),
    );
    expect(deleteCollectionMutation).toHaveBeenCalledWith({
      collectionId,
      expectedVersion: 1,
    });

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Mutations löschen" }),
    );
    expect(deleteFolderMutation).toHaveBeenCalledWith({
      folderId,
      expectedVersion: 1,
    });
  });

  it("renames and reorders collections and folders with their versions", async () => {
    const user = userEvent.setup();
    const prompt = vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Customer API")
      .mockReturnValueOnce("Write operations");
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "Customers Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Customers umbenennen" }),
    );
    expect(updateCollectionMutation).toHaveBeenCalledWith({
      collectionId,
      expectedVersion: 1,
      name: "Customer API",
    });

    await user.click(
      screen.getByRole("button", { name: "Customers Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Customers nach unten" }),
    );
    expect(updateCollectionMutation).toHaveBeenCalledWith({
      collectionId,
      expectedVersion: 1,
      targetPosition: 1,
    });

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Mutations umbenennen" }),
    );
    expect(updateFolderMutation).toHaveBeenCalledWith({
      folderId,
      expectedVersion: 1,
      name: "Write operations",
    });

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Mutations nach unten" }),
    );
    expect(updateFolderMutation).toHaveBeenCalledWith({
      folderId,
      expectedVersion: 1,
      targetPosition: 1,
    });
    expect(prompt).toHaveBeenCalledTimes(2);
  });

  it("creates requests and subfolders inside nested folders", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: "Request in Mutations erstellen",
      }),
    );
    expect(
      screen.queryByRole("menuitem", {
        name: "Request in Mutations erstellen",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(`Request anlegen ${folderId}`),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    await user.click(
      screen.getByRole("menuitem", {
        name: "Unterordner in Mutations erstellen",
      }),
    );
    expect(
      screen.getByLabelText(`Ordner anlegen ${folderId}`),
    ).toBeInTheDocument();
  });

  it("offers compact menus for requests and folders", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "Mutations Optionen" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Mutations umbenennen" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", {
        name: "Request in Mutations erstellen",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Create customer Optionen" }),
    );
    expect(
      screen.getByRole("menuitem", { name: "Duplizieren" }),
    ).toBeVisible();
    expect(
      screen.getByRole("menuitem", { name: "Verschieben" }),
    ).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Löschen" })).toBeVisible();
  });

  it("moves requests and folders with drag and drop", () => {
    renderWorkspace();
    const dataTransfer = {
      dropEffect: "move",
      effectAllowed: "move",
      getData: vi.fn(() => ""),
      setData: vi.fn(),
    };

    const requestRow = screen
      .getByRole("button", { name: "GET List customers" })
      .closest(".request-row");
    const folderRow = screen
      .getByRole("button", { name: "Mutations" })
      .closest(".nested-folder");
    const internalCollection = screen
      .getByRole("button", { name: "Internal" })
      .closest(".tree-parent");
    expect(requestRow).not.toBeNull();
    expect(folderRow).not.toBeNull();
    expect(internalCollection).not.toBeNull();

    fireEvent.dragStart(requestRow!, { dataTransfer });
    fireEvent.dragOver(folderRow!, { dataTransfer });
    fireEvent.drop(folderRow!, { dataTransfer });
    expect(moveRequestMutation).toHaveBeenCalledWith({
      requestId: firstRequestId,
      collectionId,
      folderId,
    });

    fireEvent.dragStart(folderRow!, { dataTransfer });
    fireEvent.dragOver(internalCollection!, { dataTransfer });
    fireEvent.drop(internalCollection!, { dataTransfer });
    expect(updateFolderMutation).toHaveBeenCalledWith({
      folderId,
      expectedVersion: 1,
      destination: {
        collectionId: secondCollectionId,
        parentFolderId: null,
      },
    });
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
      screen.getByRole("button", { name: "POST Create customer" }),
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

  it("confirms deletion, sends the loaded version and closes its tab", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Löschen" }));

    await waitFor(() =>
      expect(deleteRequestMutation).toHaveBeenCalledWith({
        requestId: firstRequestId,
        expectedVersion: 1,
      }),
    );
    expect(
      screen.queryByRole("tab", { name: /List customers/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Kein Request ausgewählt")).toBeInTheDocument();
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

  it("searches requests by URL and focuses search with the shortcut", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.keyboard("{Control>}p{/Control}");
    const search = screen.getByLabelText("Workspace durchsuchen");
    expect(search).toHaveFocus();
    await user.type(search, "customers");

    expect(screen.getAllByText("List customers")).not.toHaveLength(0);
    expect(
      screen.getAllByText("https://api.example.com/customers"),
    ).toHaveLength(2);
  });

  it("saves, sends and closes only the active tab with shortcuts", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.keyboard("{Control>}s{/Control}");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(shortcutSubmission.mock.calls).toEqual([["save"], ["execute"]]);

    await user.keyboard("{Control>}w{/Control}");
    expect(
      screen.getByText("Kein Request ausgewählt"),
    ).toBeInTheDocument();
  });
});
