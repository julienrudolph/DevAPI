import type { RequestDraft } from "@api-client/contracts";
import { describe, expect, it } from "vitest";

import { formatCodeSnippet } from "./code-snippets";

const draft: RequestDraft = {
  name: "List",
  method: "POST",
  url: "https://api.example.com/messages",
  queryParams: [
    {
      id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a3",
      key: "limit",
      value: "20",
      enabled: true,
    },
    {
      id: "e5c539a4-3fa9-4bc4-b6dc-acba97f1c9a4",
      key: "disabled",
      value: "x",
      enabled: false,
    },
  ],
  headers: [
    {
      id: "b1eab850-761b-4530-9c4c-ee22c42d39bb",
      key: "Content-Type",
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
  body: { type: "json", content: '{"message":"Hallo"}' },
  assertions: [],
};

describe("formatCodeSnippet", () => {
  it("formats a fetch snippet with only enabled headers, query params and the body", () => {
    const snippet = formatCodeSnippet(draft, "fetch");
    expect(snippet).toContain("limit=20");
    expect(snippet).not.toContain("disabled=x");
    expect(snippet).toContain('"Content-Type": "application/json"');
    expect(snippet).not.toContain("X-Disabled");
    expect(snippet).toContain('method: "POST"');
    expect(snippet).toContain('"{\\"message\\":\\"Hallo\\"}"');
  });

  it("formats a python requests snippet", () => {
    const snippet = formatCodeSnippet(draft, "python");
    expect(snippet).toContain("import requests");
    expect(snippet).toContain("limit=20");
    expect(snippet).toContain('"Content-Type": "application/json"');
    expect(snippet).toContain("requests.post(");
    expect(snippet).toContain("headers=headers");
    expect(snippet).toContain("data=data");
  });

  it("omits headers/body objects entirely when there is nothing enabled", () => {
    const minimal: RequestDraft = {
      ...draft,
      headers: [],
      body: { type: "none" },
    };
    const fetchSnippet = formatCodeSnippet(minimal, "fetch");
    expect(fetchSnippet).not.toContain("headers:");
    expect(fetchSnippet).not.toContain("body:");

    const pythonSnippet = formatCodeSnippet(minimal, "python");
    expect(pythonSnippet).not.toContain("headers =");
    expect(pythonSnippet).not.toContain("headers=headers");
  });

  it("delegates to the existing cURL formatter", () => {
    expect(formatCodeSnippet(draft, "curl")).toContain("curl");
  });
});
