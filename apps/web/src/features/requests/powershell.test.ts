import { describe, expect, it } from "vitest";

import { formatPowerShell, parsePowerShell } from "./powershell";

describe("PowerShell import and export", () => {
  it("imports method, a headers hashtable and a JSON body", () => {
    expect(
      parsePowerShell(
        `Invoke-RestMethod -Uri 'https://api.example.com/messages' -Method POST -Headers @{ "Content-Type" = "application/json"; "Authorization" = "Bearer local-token" } -Body '{"message":"Hallo"}'`,
      ),
    ).toMatchObject({
      method: "POST",
      url: "https://api.example.com/messages",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
        {
          key: "Authorization",
          value: "Bearer local-token",
          enabled: true,
        },
      ],
      body: { type: "json", content: '{"message":"Hallo"}' },
    });
  });

  it("accepts Invoke-WebRequest and the irm/iwr aliases", () => {
    expect(
      parsePowerShell(
        "Invoke-WebRequest -Uri 'https://api.example.com/health'",
      ),
    ).toMatchObject({ method: "GET" });
    expect(
      parsePowerShell("irm -Uri 'https://api.example.com/health'"),
    ).toMatchObject({ method: "GET" });
    expect(
      parsePowerShell("iwr -Uri 'https://api.example.com/health'"),
    ).toMatchObject({ method: "GET" });
  });

  it("infers POST when a body is present and rejects unsupported methods", () => {
    expect(
      parsePowerShell(
        "Invoke-RestMethod -Uri 'https://api.example.com/messages' -Body 'hello'",
      ),
    ).toMatchObject({
      method: "POST",
      body: { type: "text", content: "hello" },
    });
    expect(() =>
      parsePowerShell(
        "Invoke-RestMethod -Uri 'https://api.example.com' -Method TRACE",
      ),
    ).toThrow("TRACE");
  });

  it("joins a backtick line-continued command before parsing", () => {
    expect(
      parsePowerShell(
        "Invoke-RestMethod -Uri 'https://api.example.com/health' `\n  -Method GET",
      ),
    ).toMatchObject({ method: "GET" });
  });

  it("rejects a command that does not start with a known Invoke cmdlet", () => {
    expect(() =>
      parsePowerShell("Write-Host 'https://api.example.com'"),
    ).toThrow();
  });

  it("exports headers as a hashtable and only enabled entries", () => {
    const command = formatPowerShell({
      name: "List",
      method: "GET",
      url: "https://api.example.com/customers",
      queryParams: [
        {
          id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a3",
          key: "limit",
          value: "20",
          enabled: true,
        },
      ],
      headers: [
        {
          id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
          key: "Accept",
          value: "application/json",
          enabled: true,
        },
        {
          id: "f48c8753-c539-48b8-8ca9-553c72476dbc",
          key: "X-Disabled",
          value: "secret",
          enabled: false,
        },
      ],
      body: { type: "none" },
      assertions: [],
    });

    expect(command).toContain("limit=20");
    expect(command).toContain("'Accept' = 'application/json'");
    expect(command).not.toContain("X-Disabled");
    expect(command).toContain("Invoke-RestMethod -Uri");
  });

  it("exports a request without headers as a single inline command", () => {
    const command = formatPowerShell({
      name: "Health",
      method: "GET",
      url: "https://api.example.com/health",
      queryParams: [],
      headers: [],
      body: { type: "none" },
      assertions: [],
    });

    expect(command).toBe(
      "Invoke-RestMethod -Uri 'https://api.example.com/health' -Method GET",
    );
  });

  it("round-trips a command it exported itself", () => {
    const original = {
      name: "Create",
      method: "POST" as const,
      url: "https://api.example.com/customers",
      queryParams: [],
      headers: [
        {
          id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
          key: "Content-Type",
          value: "application/json",
          enabled: true,
        },
      ],
      body: { type: "json" as const, content: '{"name":"Ada"}' },
      assertions: [],
    };

    const command = formatPowerShell(original);
    const reimported = parsePowerShell(command);

    expect(reimported).toMatchObject({
      method: "POST",
      url: "https://api.example.com/customers",
      headers: [
        { key: "Content-Type", value: "application/json", enabled: true },
      ],
      body: { type: "json", content: '{"name":"Ada"}' },
    });
  });
});
