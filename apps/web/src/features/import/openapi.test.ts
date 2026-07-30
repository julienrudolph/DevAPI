import { describe, expect, it } from "vitest";

import { parseOpenApi } from "./openapi";

describe("parseOpenApi", () => {
  it("imports OpenAPI YAML operations, parameters and JSON examples", () => {
    const result = parseOpenApi(`
openapi: 3.1.0
info:
  title: Customer API
paths:
  /customers:
    get:
      summary: Kunden auflisten
      parameters:
        - in: query
          name: limit
          required: false
          schema:
            type: integer
            default: 10
    post:
      operationId: createCustomer
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  example: Ada
servers:
  - url: https://api.example.com
`);

    expect(result.title).toBe("Customer API");
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0]).toMatchObject({
      name: "Kunden auflisten",
      method: "GET",
      url: "https://api.example.com/customers",
      queryParams: [{ key: "limit", value: "10", enabled: false }],
    });
    expect(result.requests[1]).toMatchObject({
      name: "createCustomer",
      method: "POST",
      body: { type: "json", content: '{\n  "name": "Ada"\n}' },
    });
    expect(result.requests[1]?.headers).toEqual([
      expect.objectContaining({
        key: "Content-Type",
        value: "application/json",
      }),
    ]);
  });

  it("rejects unsupported specifications and documents without operations", () => {
    expect(() =>
      parseOpenApi('{"swagger":"2.0","paths":{}}'),
    ).toThrow("kein OpenAPI-Dokument");
    expect(() =>
      parseOpenApi('{"openapi":"3.1.0","paths":{}}'),
    ).toThrow("keine unterstützten REST-Operationen");
  });
});
