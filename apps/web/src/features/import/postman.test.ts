import { describe, expect, it } from "vitest";

import { parsePostmanCollection } from "./postman";

describe("Postman collection import", () => {
  it("imports nested requests, redacts secrets, and preserves form fields", () => {
    const result = parsePostmanCollection(
      JSON.stringify({
        info: { name: "Customers" },
        item: [
          {
            name: "Users",
            item: [
              {
                name: "Create user",
                request: {
                  method: "POST",
                  url: {
                    raw: "https://api.example.test/users?active=true",
                    query: [{ key: "active", value: "true" }],
                  },
                  header: [
                    { key: "Authorization", value: "Bearer secret" },
                    { key: "Accept", value: "application/json" },
                  ],
                  body: {
                    mode: "urlencoded",
                    urlencoded: [{ key: "name", value: "Max" }],
                  },
                },
              },
            ],
          },
        ],
      }),
    );

    expect(result.title).toBe("Customers");
    expect(result.requests[0]).toMatchObject({
      path: "Users / Create user",
      url: "https://api.example.test/users",
      method: "POST",
      body: { type: "form-urlencoded", content: "name=Max" },
    });
    expect(result.requests[0]?.headers).toEqual([
      expect.objectContaining({ key: "Authorization", value: "" }),
      expect.objectContaining({ key: "Accept", value: "application/json" }),
    ]);
  });

  it("rejects unrelated JSON documents", () => {
    expect(() => parsePostmanCollection('{"hello":"world"}')).toThrow(
      "keine Postman Collection",
    );
  });
});
