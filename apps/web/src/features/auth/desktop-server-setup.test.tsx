import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DesktopServerSetup } from "./desktop-server-setup";

afterEach(() => {
  cleanup();
  delete window.devapiDesktop;
});

describe("DesktopServerSetup", () => {
  it("stores the selected server through the minimal desktop bridge", async () => {
    const user = userEvent.setup();
    const setServerUrl = vi.fn().mockResolvedValue(
      "https://devapi.example.test",
    );
    window.devapiDesktop = {
      platform: "win32",
      getServerUrl: vi.fn().mockResolvedValue(null),
      setServerUrl,
    };
    render(<DesktopServerSetup />);

    await user.type(
      screen.getByLabelText("Serveradresse"),
      "https://devapi.example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Mit Server verbinden" }),
    );

    expect(setServerUrl).toHaveBeenCalledWith(
      "https://devapi.example.test",
    );
  });

  it("does not expose server controls in a normal browser", () => {
    render(<DesktopServerSetup />);
    expect(
      screen.getByText(/keine gültige öffentliche Clientkonfiguration/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Serveradresse")).not.toBeInTheDocument();
  });
});
