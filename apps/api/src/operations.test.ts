import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { HttpOperations, validBearerToken } from "./operations.js";

describe("HTTP operations", () => {
  it("exports low-cardinality route metrics without URLs", async () => {
    const app = Fastify();
    const operations = new HttpOperations();
    operations.attach(app);
    app.get("/items/:id", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/items/secret-value" });
    const output = operations.render("devapi_api");

    expect(output).toContain('route="/items/:id"');
    expect(output).not.toContain("secret-value");
    await app.close();
  });

  it("compares bearer tokens exactly", () => {
    expect(validBearerToken("Bearer abc", "abc")).toBe(true);
    expect(validBearerToken("Bearer abd", "abc")).toBe(false);
    expect(validBearerToken(undefined, "abc")).toBe(false);
  });
});
