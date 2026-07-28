import { describe, expect, it } from "vitest";

import {
  assertPublicIp,
  parseAllowedUrl,
  resolvePublicTarget,
  UnsafeTargetError,
} from "./target-policy.js";

describe("target policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.2",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fe80::1",
    "fc00::1",
    "0.0.0.0",
  ])("blocks non-public address %s", (address) => {
    expect(() => assertPublicIp(address)).toThrow(UnsafeTargetError);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "accepts public address %s",
    (address) => {
      expect(() => assertPublicIp(address)).not.toThrow();
    },
  );

  it("blocks local names, credentials and non-http protocols", () => {
    expect(() => parseAllowedUrl("http://localhost/admin")).toThrow();
    expect(() => parseAllowedUrl("http://service.local")).toThrow();
    expect(() => parseAllowedUrl("file:///etc/passwd")).toThrow();
    expect(() => parseAllowedUrl("https://user:secret@example.com")).toThrow();
  });

  it("rejects a hostname when any DNS result is private", async () => {
    const resolver = async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "127.0.0.1", family: 4 as const },
    ];
    await expect(
      resolvePublicTarget("https://example.com", resolver),
    ).rejects.toBeInstanceOf(UnsafeTargetError);
  });
});
