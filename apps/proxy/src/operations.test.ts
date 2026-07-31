import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { HttpOperations, validBearerToken } from "./operations.js";

describe("proxy operations", () => {
  it("uses route patterns instead of requested target values", async () => {
    const app = Fastify();
    const operations = new HttpOperations();
    operations.attach(app);
    app.get("/items/:id", async () => ({ ok: true }));

    await app.inject({ method: "GET", url: "/items/secret-value" });
    const output = operations.render();

    expect(output).toContain('route="/items/:id"');
    expect(output).not.toContain("secret-value");
    await app.close();
  });

  it("requires the exact metrics token", () => {
    expect(validBearerToken("Bearer abc", "abc")).toBe(true);
    expect(validBearerToken("Bearer ab", "abc")).toBe(false);
  });
});
