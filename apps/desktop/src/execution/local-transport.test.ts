import { describe, expect, it, vi } from "vitest";

import { createPinnedLookup } from "./local-transport.js";

describe("createPinnedLookup", () => {
  it("returns the validated address as a list when requested by undici", () => {
    const callback = vi.fn();

    createPinnedLookup("127.0.0.1", 4)(
      "devserver.local",
      { all: true },
      callback,
    );

    expect(callback).toHaveBeenCalledWith(null, [
      { address: "127.0.0.1", family: 4 },
    ]);
  });

  it("supports the single-address lookup form", () => {
    const callback = vi.fn();

    createPinnedLookup("::1", 6)("devserver.local", { all: false }, callback);

    expect(callback).toHaveBeenCalledWith(null, "::1", 6);
  });
});
