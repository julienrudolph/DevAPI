// Mirrors apps/proxy/src/security/proxy-config.ts (AGENTS.md 11.1b).
// Duplicated rather than imported across the app boundary, same as the
// local-target-policy vs. target-policy split.
export interface UpstreamProxyConfig {
  httpProxyUrl?: string;
  httpsProxyUrl?: string;
  noProxy: string[];
}

export function readUpstreamProxyConfig(
  env: Record<string, string | undefined> = process.env,
): UpstreamProxyConfig {
  const httpProxyUrl = firstDefined(env.HTTP_PROXY, env.http_proxy);
  const httpsProxyUrl = firstDefined(env.HTTPS_PROXY, env.https_proxy);
  const noProxyRaw = firstDefined(env.NO_PROXY, env.no_proxy) ?? "";
  const noProxy = noProxyRaw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return { httpProxyUrl, httpsProxyUrl, noProxy };
}

export function matchesNoProxy(noProxy: string[], hostname: string): boolean {
  const target = hostname.toLowerCase().replace(/\.$/, "");
  return noProxy.some((entry) => {
    if (entry === "*") return true;
    const pattern = entry.replace(/^\./, "");
    return target === pattern || target.endsWith(`.${pattern}`);
  });
}

export function selectUpstreamProxy(
  config: UpstreamProxyConfig,
  url: URL,
): string | undefined {
  if (matchesNoProxy(config.noProxy, url.hostname)) return undefined;
  return url.protocol === "https:" ? config.httpsProxyUrl : config.httpProxyUrl;
}

// Parses the PAC-style result string Electron's session.resolveProxy()
// returns (e.g. "PROXY proxy.corp.example:8080; DIRECT"), taking the first
// entry undici's ProxyAgent can actually use. SOCKS proxy entries are not
// supported (undici only speaks HTTP CONNECT) and are skipped in favor of a
// later HTTP/HTTPS/PROXY entry or, failing that, treated as no proxy.
export function parseResolvedProxyString(
  resolved: string,
): string | undefined {
  for (const entry of resolved.split(";")) {
    const [rawScheme, hostPort] = entry.trim().split(/\s+/, 2);
    const scheme = rawScheme?.toUpperCase();
    if (!hostPort) continue;
    if (scheme === "PROXY" || scheme === "HTTP") return `http://${hostPort}`;
    if (scheme === "HTTPS") return `https://${hostPort}`;
  }
  return undefined;
}

function firstDefined(
  ...values: (string | undefined)[]
): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0);
}
