import { describe, expect, it } from "vitest";

import {
  assertAllowedLocalIp,
  parseAllowedLocalUrl,
  resolveLocalTarget,
  UnsafeLocalTargetError,
} from "./local-target-policy.js";

describe("local target policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.1.2",
    "192.168.1.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "1.1.1.1",
    "8.8.8.8",
  ])("allows local/private/public address %s", (address) => {
    expect(() => assertAllowedLocalIp(address)).not.toThrow();
  });

  it.each(["169.254.169.254", "fd00:ec2::254", "0.0.0.0"])(
    "still blocks known-unsafe address %s",
    (address) => {
      expect(() => assertAllowedLocalIp(address)).toThrow(
        UnsafeLocalTargetError,
      );
    },
  );

  it("allows localhost as a hostname", () => {
    expect(() => parseAllowedLocalUrl("http://localhost:3000/health")).not.toThrow();
    expect(() => parseAllowedLocalUrl("http://myapp.local/health")).not.toThrow();
  });

  it("still blocks cloud metadata hostnames, credentials and non-http protocols", () => {
    expect(() => parseAllowedLocalUrl("http://metadata.google.internal/")).toThrow();
    expect(() => parseAllowedLocalUrl("http://metadata/latest")).toThrow();
    expect(() => parseAllowedLocalUrl("file:///etc/passwd")).toThrow();
    expect(() =>
      parseAllowedLocalUrl("https://user:secret@example.com"),
    ).toThrow();
  });

  it("rejects a hostname when any DNS result is a blocked metadata address", async () => {
    const resolver = async () => [
      { address: "127.0.0.1", family: 4 as const },
      { address: "169.254.169.254", family: 4 as const },
    ];
    await expect(
      resolveLocalTarget("http://devserver.local", resolver),
    ).rejects.toBeInstanceOf(UnsafeLocalTargetError);
  });

  it("resolves a loopback hostname to its address", async () => {
    const resolver = async () => [{ address: "127.0.0.1", family: 4 as const }];
    const target = await resolveLocalTarget("http://localhost:5173", resolver);
    expect(target.addresses).toEqual(["127.0.0.1"]);
  });
});
