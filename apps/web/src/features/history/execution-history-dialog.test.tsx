import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExecutionHistoryDialog } from "./execution-history-dialog";
import { useExecutionHistory } from "./execution-history-queries";

vi.mock("./execution-history-queries", () => ({
  useExecutionHistory: vi.fn(),
}));

afterEach(cleanup);

describe("ExecutionHistoryDialog", () => {
  it("shows bounded metadata and communicates excluded sensitive data", () => {
    vi.mocked(useExecutionHistory).mockReturnValue({
      data: [
        {
          id: "2a20ff6e-a6de-421e-bedd-01ef3a87c539",
          requestId: "fa7596b3-0041-4fe8-9ddf-956e7a107014",
          requestName: "Health",
          method: "GET",
          statusCode: 200,
          durationMs: 18,
          successful: true,
          executedBy: {
            id: "4776ac0f-28ba-474a-ad0d-d566be4199e8",
            displayName: "Ada",
          },
          executedAt: "2026-07-30T09:00:00.000Z",
        },
      ],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useExecutionHistory>);

    render(
      <ExecutionHistoryDialog
        onClose={vi.fn()}
        workspaceId="85e52968-22cc-483d-b6a6-bdc169e46ede"
      />,
    );

    expect(screen.getByText("Health")).toBeInTheDocument();
    expect(screen.getByText("200")).toHaveClass("status-ok");
    expect(
      screen.getByText(/URL, Header, Zugangsdaten/),
    ).toBeInTheDocument();
  });
});
