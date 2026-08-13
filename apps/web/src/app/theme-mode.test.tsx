import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeModeProvider, useThemeMode } from "./theme-mode";

function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  window.matchMedia = vi.fn().mockReturnValue({
    matches: prefersDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_event: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      listeners.delete(listener),
  }) as unknown as typeof window.matchMedia;
}

function Probe() {
  const { mode, resolvedMode, setMode } = useThemeMode();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="resolved">{resolvedMode}</span>
      <button onClick={() => setMode("dark")}>dark</button>
      <button onClick={() => setMode("light")}>light</button>
      <button onClick={() => setMode("system")}>system</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  stubMatchMedia(false);
});

afterEach(cleanup);

describe("useThemeMode", () => {
  it("defaults to system and resolves against the OS preference", () => {
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persists an explicit choice and updates the document attribute", async () => {
    const user = userEvent.setup();
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("devapi:theme-mode")).toBe("dark");

    cleanup();
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("dark");
  });

  it("resolves system mode to dark when the OS prefers dark", () => {
    stubMatchMedia(true);
    render(
      <ThemeModeProvider>
        <Probe />
      </ThemeModeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });
});
