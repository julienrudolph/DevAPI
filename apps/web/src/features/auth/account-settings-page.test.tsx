import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { AccountSettingsPage } from "./account-settings-page";
import { AccountDeletionError } from "./account-api";
import { useAuth } from "./auth-context";
import { useAccountDeletionCheck, useDeleteAccount } from "./account-queries";

vi.mock("./auth-context", () => ({
  useAuth: vi.fn(),
}));
vi.mock("./account-queries", () => ({
  useAccountDeletionCheck: vi.fn(),
  useDeleteAccount: vi.fn(),
}));

const navigate = vi.fn();
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>(
    "react-router",
  );
  return { ...actual, useNavigate: () => navigate };
});

const signOut = vi.fn();

beforeEach(() => {
  navigate.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  vi.mocked(useAuth).mockReturnValue({
    client: { auth: { signOut } },
    user: { email: "ada@example.test" },
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(useAccountDeletionCheck).mockReturnValue({
    data: [],
    isPending: false,
    isSuccess: true,
  } as unknown as ReturnType<typeof useAccountDeletionCheck>);
});

afterEach(() => {
  cleanup();
  delete window.devapiDesktop;
});

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSettingsPage />
    </MemoryRouter>,
  );
}

describe("AccountSettingsPage", () => {
  it("hides the server section outside the desktop client", () => {
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);

    renderPage();

    expect(screen.queryByText("DevAPI-Server")).not.toBeInTheDocument();
  });

  it("lets a desktop user change the configured server address", async () => {
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);
    const setServerUrl = vi.fn().mockResolvedValue(
      "https://devapi2.example.test",
    );
    window.devapiDesktop = {
      platform: "win32",
      getServerUrl: vi.fn().mockResolvedValue("https://devapi.example.test"),
      setServerUrl,
    };
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    renderPage();

    const input = await screen.findByLabelText("Serveradresse");
    expect(input).toHaveValue("https://devapi.example.test");
    await user.clear(input);
    await user.type(input, "https://devapi2.example.test");
    await user.click(screen.getByRole("button", { name: "Server speichern" }));

    expect(setServerUrl).toHaveBeenCalledWith("https://devapi2.example.test");
  });

  it("requires the confirmation email to match before enabling deletion", async () => {
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);

    const user = userEvent.setup();
    renderPage();

    const button = screen.getByRole("button", {
      name: "Konto endgültig löschen",
    });
    expect(button).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Gib zur Bestätigung/, { exact: false }),
      "ada@example.test",
    );
    expect(button).toBeEnabled();
  });

  it("deletes the account and signs out after confirmation", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/Gib zur Bestätigung/, { exact: false }),
      "ada@example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Konto endgültig löschen" }),
    );

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      confirmEmail: "ada@example.test",
    }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("blocks deletion and lists teams when the caller is a sole owner", () => {
    vi.mocked(useAccountDeletionCheck).mockReturnValue({
      data: [{ id: "team-1", name: "Solo Team" }],
      isPending: false,
      isSuccess: true,
    } as unknown as ReturnType<typeof useAccountDeletionCheck>);
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);

    renderPage();

    expect(screen.getByText("Solo Team")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Konto endgültig löschen" }),
    ).not.toBeInTheDocument();
  });

  it("surfaces the sole-owner block reported at deletion time", async () => {
    const error = new AccountDeletionError("SOLE_OWNER_OF_TEAMS", [
      { id: "team-2", name: "Late Team" },
    ]);
    const mutateAsync = vi.fn().mockRejectedValue(error);
    vi.mocked(useDeleteAccount).mockReturnValue({
      mutateAsync,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useDeleteAccount>);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/Gib zur Bestätigung/, { exact: false }),
      "ada@example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Konto endgültig löschen" }),
    );

    expect(await screen.findByText("Late Team")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
