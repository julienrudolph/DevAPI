import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentVariableRow } from "./environment-controls";
import { EnvironmentVariableConflictError } from "./environment-api";
import { useUpdateEnvironmentVariable } from "./environment-queries";

vi.mock("./environment-queries", () => ({
  useUpdateEnvironmentVariable: vi.fn(),
}));

afterEach(cleanup);

describe("EnvironmentVariableRow", () => {
  it("keeps the local value and retries against the current version", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEnvironmentVariable).mockReturnValue({
      mutateAsync,
      isPending: false,
      reset: vi.fn(),
      error: new EnvironmentVariableConflictError({
        code: "ENVIRONMENT_VARIABLE_VERSION_CONFLICT",
        message: "Konflikt",
        expectedVersion: 1,
        currentVersion: 2,
        current: {
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
          key: "baseUrl",
          value: "https://team.example.com",
          scope: "shared",
          version: 2,
        },
      }),
    } as unknown as ReturnType<typeof useUpdateEnvironmentVariable>);

    render(
      <EnvironmentVariableRow
        canEdit
        variable={{
          id: "8f48a4d0-05e0-4cd2-bdbc-35c0a19a8bd8",
          environmentId: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
          key: "baseUrl",
          value: "https://old.example.com",
          scope: "shared",
          version: 1,
        }}
        workspaceId="85e52968-22cc-483d-b6a6-bdc169e46ede"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Bearbeiten" }));
    const input = screen.getByLabelText("baseUrl bearbeiten");
    await user.clear(input);
    await user.type(input, "https://local.example.com");
    await user.click(
      screen.getByRole("button", { name: "Meinen Wert speichern" }),
    );

    expect(mutateAsync).toHaveBeenCalledWith({
      value: "https://local.example.com",
      expectedVersion: 2,
    });
  });
});
