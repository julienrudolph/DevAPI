import { describe, expect, it, vi } from "vitest";

import { createPinnedLookup } from "./undici-transport.js";

describe("createPinnedLookup", () => {
  it("returns the validated address as a list when requested by undici", () => {
    const callback = vi.fn();

    createPinnedLookup("203.0.113.10", 4)(
      "api.example.test",
      { all: true },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, [
      { address: "203.0.113.10", family: 4 },
    ]);
  });

  it("supports the single-address lookup form", () => {
    const callback = vi.fn();

    createPinnedLookup("2001:db8::10", 6)(
      "api.example.test",
      { all: false },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, "2001:db8::10", 6);
  });
});
