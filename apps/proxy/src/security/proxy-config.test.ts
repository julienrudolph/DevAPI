import { describe, expect, it } from "vitest";

import {
  matchesNoProxy,
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

  it("falls back to lowercase proxy variables", () => {
    expect(
      readUpstreamProxyConfig({
        http_proxy: "http://proxy.corp.example:8080",
        https_proxy: "http://proxy.corp.example:8443",
        no_proxy: "*",
      }),
    ).toEqual({
      httpProxyUrl: "http://proxy.corp.example:8080",
      httpsProxyUrl: "http://proxy.corp.example:8443",
      noProxy: ["*"],
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
  it("matches an exact hostname", () => {
    expect(matchesNoProxy(["internal.corp.example"], "internal.corp.example")).toBe(
      true,
    );
    expect(matchesNoProxy(["internal.corp.example"], "other.example")).toBe(false);
  });

  it("matches subdomains for a bare domain entry", () => {
    expect(matchesNoProxy(["corp.example"], "ci.corp.example")).toBe(true);
  });

  it("matches subdomains for a leading-dot entry", () => {
    expect(matchesNoProxy([".corp.example"], "ci.corp.example")).toBe(true);
  });

  it("does not match an unrelated suffix collision", () => {
    expect(matchesNoProxy(["corp.example"], "notcorp.example")).toBe(false);
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

  it("selects the http proxy for an http target", () => {
    expect(selectUpstreamProxy(config, new URL("http://api.example/x"))).toBe(
      "http://proxy.corp.example:8080",
    );
  });

  it("bypasses the proxy for a NO_PROXY match", () => {
    expect(
      selectUpstreamProxy(config, new URL("https://internal.corp.example/x")),
    ).toBeUndefined();
  });

  it("returns undefined when no proxy is configured for the protocol", () => {
    expect(
      selectUpstreamProxy(
        { httpProxyUrl: undefined, httpsProxyUrl: undefined, noProxy: [] },
        new URL("https://api.example/x"),
      ),
    ).toBeUndefined();
  });
});
