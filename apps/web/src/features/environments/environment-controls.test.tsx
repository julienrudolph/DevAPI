import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentControls, EnvironmentVariableRow } from "./environment-controls";
import { EnvironmentVariableConflictError } from "./environment-api";
import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useDeleteEnvironmentVariable,
  useEnvironments,
  useUpdateEnvironment,
  useUpdateEnvironmentVariable,
} from "./environment-queries";

vi.mock("./environment-queries", () => ({
  useCreateEnvironment: vi.fn(),
  useCreateEnvironmentVariable: vi.fn(),
  useDeleteEnvironment: vi.fn(),
  useDeleteEnvironmentVariable: vi.fn(),
  useEnvironments: vi.fn(),
  useUpdateEnvironment: vi.fn(),
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
    vi.mocked(useDeleteEnvironmentVariable).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironmentVariable>);

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

  it("renames a variable via the pencil button when editable", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEnvironmentVariable).mockReturnValue({
      mutateAsync,
      isPending: false,
      reset: vi.fn(),
      error: null,
    } as unknown as ReturnType<typeof useUpdateEnvironmentVariable>);
    vi.mocked(useDeleteEnvironmentVariable).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironmentVariable>);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("newKey");

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
    await user.click(screen.getByRole("button", { name: "baseUrl umbenennen" }));

    expect(mutateAsync).toHaveBeenCalledWith({
      key: "newKey",
      expectedVersion: 1,
    });
    promptSpy.mockRestore();
  });

  it("removes a variable via the trash button when editable", async () => {
    const user = userEvent.setup();
    const removeMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEnvironmentVariable).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      reset: vi.fn(),
      error: null,
    } as unknown as ReturnType<typeof useUpdateEnvironmentVariable>);
    vi.mocked(useDeleteEnvironmentVariable).mockReturnValue({
      mutateAsync: removeMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironmentVariable>);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

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
    await user.click(screen.getByRole("button", { name: "baseUrl entfernen" }));

    expect(removeMutateAsync).toHaveBeenCalledWith({ expectedVersion: 1 });
    confirmSpy.mockRestore();
  });

  it("hides rename and remove actions for read-only variables", () => {
    vi.mocked(useUpdateEnvironmentVariable).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      reset: vi.fn(),
      error: null,
    } as unknown as ReturnType<typeof useUpdateEnvironmentVariable>);
    vi.mocked(useDeleteEnvironmentVariable).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironmentVariable>);

    render(
      <EnvironmentVariableRow
        canEdit={false}
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

    expect(
      screen.queryByRole("button", { name: "baseUrl umbenennen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "baseUrl entfernen" }),
    ).not.toBeInTheDocument();
  });
});

describe("EnvironmentControls", () => {
  const environment = {
    id: "a768f717-d11f-4ce0-a72b-8e1d439222b0",
    workspaceId: "85e52968-22cc-483d-b6a6-bdc169e46ede",
    name: "Development",
    version: 1,
    variables: [],
  };

  function mockCommonHooks() {
    vi.mocked(useEnvironments).mockReturnValue({
      data: [environment],
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useEnvironments>);
    vi.mocked(useCreateEnvironment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateEnvironment>);
  }

  it("renames the selected environment via the pencil button", async () => {
    const user = userEvent.setup();
    mockCommonHooks();
    const updateMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEnvironment).mockReturnValue({
      mutateAsync: updateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateEnvironment>);
    vi.mocked(useDeleteEnvironment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironment>);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Staging");

    render(
      <EnvironmentControls
        canEditShared
        onSelect={vi.fn()}
        selectedId={environment.id}
        workspaceId={environment.workspaceId}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Development umbenennen" }),
    );

    expect(updateMutateAsync).toHaveBeenCalledWith({
      name: "Staging",
      expectedVersion: 1,
    });
    promptSpy.mockRestore();
  });

  it("deletes the selected environment via the trash button", async () => {
    const user = userEvent.setup();
    mockCommonHooks();
    const deleteMutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useUpdateEnvironment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateEnvironment>);
    vi.mocked(useDeleteEnvironment).mockReturnValue({
      mutateAsync: deleteMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironment>);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onSelect = vi.fn();

    render(
      <EnvironmentControls
        canEditShared
        onSelect={onSelect}
        selectedId={environment.id}
        workspaceId={environment.workspaceId}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Development löschen" }),
    );

    expect(deleteMutateAsync).toHaveBeenCalledWith({ expectedVersion: 1 });
    confirmSpy.mockRestore();
  });

  it("hides environment rename and delete actions for viewers", () => {
    mockCommonHooks();
    vi.mocked(useUpdateEnvironment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateEnvironment>);
    vi.mocked(useDeleteEnvironment).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteEnvironment>);

    render(
      <EnvironmentControls
        canEditShared={false}
        onSelect={vi.fn()}
        selectedId={environment.id}
        workspaceId={environment.workspaceId}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Development umbenennen" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Development löschen" }),
    ).not.toBeInTheDocument();
  });
});
