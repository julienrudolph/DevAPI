import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";

import { LoginPage } from "./login-page";
import { useAuth } from "./auth-context";

vi.mock("./auth-context", () => ({
  useAuth: vi.fn(),
}));

const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signInWithOtp = vi.fn();

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  signUp.mockReset().mockResolvedValue({
    data: { session: {} },
    error: null,
  });
  signInWithOtp.mockReset().mockResolvedValue({
    data: {},
    error: null,
  });
  vi.mocked(useAuth).mockReturnValue({
    client: {
      auth: { signInWithPassword, signUp, signInWithOtp },
    },
    configurationError: false,
    env: {
      apiBaseUrl: "/api",
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: "key",
      passwordAuthEnabled: true,
      passwordSignupEnabled: true,
      magicLinkAuthEnabled: false,
    },
    user: null,
    accessToken: null,
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(cleanup);

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage password authentication", () => {
  it("uses password sign-in as the default and hides Magic Link", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("E-Mail-Adresse"), "ada@example.test");
    await user.type(screen.getByLabelText("Passwort"), "correct horse");
    await user.click(
      screen.getAllByRole("button", { name: "Anmelden" }).at(-1)!,
    );

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "ada@example.test",
        password: "correct horse",
      }),
    );
    expect(
      screen.queryByRole("button", { name: "Anmeldelink senden" }),
    ).not.toBeInTheDocument();
  });

  it("requires twelve characters before creating an account", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Registrieren" }));
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "ada@example.test");
    await user.type(screen.getByLabelText("Passwort"), "short");
    await user.click(screen.getByRole("button", { name: "Konto erstellen" }));

    expect(
      await screen.findByText(/mindestens 12 Zeichen/),
    ).toBeInTheDocument();
    expect(signUp).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText("Passwort"));
    await user.type(
      screen.getByLabelText("Passwort"),
      "a-secure-password",
    );
    await user.click(screen.getByRole("button", { name: "Konto erstellen" }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "ada@example.test",
          password: "a-secure-password",
        }),
      ),
    );
  });
});
