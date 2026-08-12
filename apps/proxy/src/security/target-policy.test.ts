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

  it.each([
    ["http://2130706433/", "decimal"],
    ["http://0x7f000001/", "hex"],
    ["http://0177.0.0.1/", "octal"],
  ])(
    "blocks loopback expressed as %s IPv4 literal (%s)",
    (rawUrl) => {
      const url = parseAllowedUrl(rawUrl);
      expect(() => assertPublicIp(url.hostname)).toThrow(UnsafeTargetError);
    },
  );

  it("blocks an IPv4-mapped IPv6 loopback address", () => {
    const url = parseAllowedUrl("http://[::ffff:127.0.0.1]/");
    expect(() => assertPublicIp(url.hostname.replace(/^\[|\]$/g, ""))).toThrow(
      UnsafeTargetError,
    );
  });

  it("does not use a stale or rebindable resolver result once an address is validated", async () => {
    let callCount = 0;
    const rebindingResolver = async () => {
      callCount += 1;
      // Simulates DNS-rebinding: the first (and only) lookup the policy performs
      // returns a private address, which must be rejected without a second lookup
      // that an attacker's DNS server could answer differently.
      return [{ address: "127.0.0.1", family: 4 as const }];
    };
    await expect(
      resolvePublicTarget("https://rebinding.example", rebindingResolver),
    ).rejects.toBeInstanceOf(UnsafeTargetError);
    expect(callCount).toBe(1);
  });
});
