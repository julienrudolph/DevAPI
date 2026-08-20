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

// Standard curl/wget-style NO_PROXY semantics: "*" disables the proxy
// entirely, a bare hostname matches exactly, and a leading-dot or bare
// domain also matches any subdomain (github.com and .github.com both match
// ci.github.com).
export function matchesNoProxy(noProxy: string[], hostname: string): boolean {
  const target = hostname.toLowerCase().replace(/\.$/, "");
  return noProxy.some((entry) => {
    if (entry === "*") return true;
    const pattern = entry.replace(/^\./, "");
    return target === pattern || target.endsWith(`.${pattern}`);
  });
}

// Which upstream proxy (if any) a given target should be routed through.
// Redirects can cross hosts and even protocols, so callers re-evaluate this
// for every hop rather than deciding once for the original URL.
export function selectUpstreamProxy(
  config: UpstreamProxyConfig,
  url: URL,
): string | undefined {
  if (matchesNoProxy(config.noProxy, url.hostname)) return undefined;
  return url.protocol === "https:" ? config.httpsProxyUrl : config.httpProxyUrl;
}

function firstDefined(
  ...values: (string | undefined)[]
): string | undefined {
  return values.find((value) => value !== undefined && value.length > 0);
}
