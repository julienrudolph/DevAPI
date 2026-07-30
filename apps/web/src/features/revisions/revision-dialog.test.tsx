import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RevisionDialog } from "./revision-dialog";
import {
  useRequestRevisions,
  useRestoreRequestRevision,
} from "./revision-queries";

vi.mock("./revision-queries", () => ({
  useRequestRevisions: vi.fn(),
  useRestoreRequestRevision: vi.fn(),
}));

afterEach(cleanup);

const revision = {
  id: "2a20ff6e-a6de-421e-bedd-01ef3a87c539",
  requestId: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
  version: 2,
  name: "Health",
  method: "GET" as const,
  changeType: "update" as const,
  createdBy: {
    id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
    displayName: "Ada",
  },
  createdAt: "2026-07-30T09:00:00.000Z",
};

function mockQueries() {
  vi.mocked(useRequestRevisions).mockReturnValue({
    data: [revision],
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useRequestRevisions>);
  vi.mocked(useRestoreRequestRevision).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useRestoreRequestRevision>);
}

describe("RevisionDialog", () => {
  it("allows viewers to inspect metadata without restoring", () => {
    mockQueries();
    render(
      <RevisionDialog
        canRestore={false}
        currentVersion={4}
        onClose={vi.fn()}
        onRestored={vi.fn()}
        requestId={revision.requestId}
        workspaceId="85e52968-22cc-483d-b6a6-bdc169e46ede"
      />,
    );
    expect(screen.getByText(/Version 2/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Wiederherstellen" }),
    ).not.toBeInTheDocument();
  });

  it("offers restore only to editors and owners", () => {
    mockQueries();
    render(
      <RevisionDialog
        canRestore
        currentVersion={4}
        onClose={vi.fn()}
        onRestored={vi.fn()}
        requestId={revision.requestId}
        workspaceId="85e52968-22cc-483d-b6a6-bdc169e46ede"
      />,
    );
    expect(
      screen.getByRole("button", { name: "Wiederherstellen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Header-Werte werden aus Sicherheitsgründen/),
    ).toBeInTheDocument();
  });
});
