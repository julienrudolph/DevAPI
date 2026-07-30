import { describe, expect, it } from "vitest";

import { formatCurl, parseCurl } from "./curl";

describe("cURL import and export", () => {
  it("imports method, headers and a JSON body", () => {
    expect(
      parseCurl(
        `curl --request POST 'https://api.example.com/messages' --header 'Content-Type: application/json' --header 'Authorization: Bearer local-token' --data-raw '{"message":"Hallo"}'`,
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

  it("infers POST when data is present and rejects unsupported methods", () => {
    expect(
      parseCurl("curl https://api.example.com/messages -d 'hello'"),
    ).toMatchObject({
      method: "POST",
      body: { type: "text", content: "hello" },
    });
    expect(() =>
      parseCurl("curl -X TRACE https://api.example.com"),
    ).toThrow("TRACE");
  });

  it("exports only enabled headers and query parameters", () => {
    const command = formatCurl({
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
    });

    expect(command).toContain("limit=20");
    expect(command).toContain("Accept: application/json");
    expect(command).not.toContain("X-Disabled");
  });
});
