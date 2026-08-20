import { describe, expect, it } from "vitest";

import {
  matchesNoProxy,
  parseResolvedProxyString,
  readUpstreamProxyConfig,
  selectUpstreamProxy,
} from "./proxy-config.js";

describe("readUpstreamProxyConfig", () => {
  it("reads uppercase proxy variables", () => {
    expect(
      readUpstreamProxyConfig({
        HTTP_PROXY: "http://proxy.corp.example:8080",
        HTTPS_PROXY: "http://proxy.corp.example:8443",
        NO_PROXY: "localhost, .internal.corp.example",
      }),
    ).toEqual({
      httpProxyUrl: "http://proxy.corp.example:8080",
      httpsProxyUrl: "http://proxy.corp.example:8443",
      noProxy: ["localhost", ".internal.corp.example"],
    });
  });

  it("returns an unconfigured proxy when nothing is set", () => {
    expect(readUpstreamProxyConfig({})).toEqual({
      httpProxyUrl: undefined,
      httpsProxyUrl: undefined,
      noProxy: [],
    });
  });
});

describe("matchesNoProxy", () => {
  it("matches subdomains for a bare domain entry", () => {
    expect(matchesNoProxy(["corp.example"], "ci.corp.example")).toBe(true);
  });

  it("treats a bare * as disabling the proxy for everything", () => {
    expect(matchesNoProxy(["*"], "anything.example")).toBe(true);
  });
});

describe("selectUpstreamProxy", () => {
  const config = {
    httpProxyUrl: "http://proxy.corp.example:8080",
    httpsProxyUrl: "http://proxy.corp.example:8443",
    noProxy: ["internal.corp.example"],
  };

  it("selects the https proxy for an https target", () => {
    expect(selectUpstreamProxy(config, new URL("https://api.example/x"))).toBe(
      "http://proxy.corp.example:8443",
    );
  });

  it("bypasses the proxy for a NO_PROXY match", () => {
    expect(
      selectUpstreamProxy(config, new URL("https://internal.corp.example/x")),
    ).toBeUndefined();
  });
});

describe("parseResolvedProxyString", () => {
  it("converts a PROXY entry into an http:// URL", () => {
    expect(parseResolvedProxyString("PROXY proxy.corp.example:8080")).toBe(
      "http://proxy.corp.example:8080",
    );
  });

  it("converts an HTTPS entry into an https:// URL", () => {
    expect(parseResolvedProxyString("HTTPS proxy.corp.example:8443")).toBe(
      "https://proxy.corp.example:8443",
    );
  });

  it("returns undefined for DIRECT", () => {
    expect(parseResolvedProxyString("DIRECT")).toBeUndefined();
  });

  it("skips an unsupported SOCKS entry in favor of a later PROXY entry", () => {
    expect(
      parseResolvedProxyString("SOCKS5 socks.corp.example:1080; PROXY proxy.corp.example:8080"),
    ).toBe("http://proxy.corp.example:8080");
  });

  it("returns undefined when only unsupported SOCKS entries are offered", () => {
    expect(
      parseResolvedProxyString("SOCKS5 socks.corp.example:1080; DIRECT"),
    ).toBeUndefined();
  });
});
