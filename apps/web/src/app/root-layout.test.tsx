import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";

import { useAuth } from "../features/auth/auth-context";
import { persistLanguage } from "../lib/i18n";
import { RootLayout } from "./root-layout";
import { ThemeModeProvider } from "./theme-mode";

vi.mock("../features/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

function stubMatchMedia() {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    media: "(prefers-color-scheme: dark)",
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("devapi:language");
});

function renderLayout() {
  return render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<RootLayout />} path="/">
            <Route element={<p>Inhalt</p>} index />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeModeProvider>,
  );
}

describe("RootLayout", () => {
  it("renders German chrome by default", () => {
    stubMatchMedia();
    vi.mocked(useAuth).mockReturnValue({
      client: null,
      user: { email: "ada@example.com" },
    } as unknown as ReturnType<typeof useAuth>);

    renderLayout();

    expect(screen.getByText("Zum Hauptinhalt")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sprache wechseln, aktuell Deutsch/ }),
    ).toBeInTheDocument();
  });

  it("switches the UI language and persists the choice", async () => {
    stubMatchMedia();
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      client: null,
      user: { email: "ada@example.com" },
    } as unknown as ReturnType<typeof useAuth>);

    renderLayout();

    await user.click(
      screen.getByRole("button", { name: /Sprache wechseln/ }),
    );
    await user.click(screen.getByRole("menuitem", { name: /English/ }));

    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
    expect(window.localStorage.getItem("devapi:language")).toBe("en");

    persistLanguage("de");
  });
});
