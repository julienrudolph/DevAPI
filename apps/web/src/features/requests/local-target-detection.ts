import ipaddr from "ipaddr.js";

// Client-side heuristic only (AGENTS.md 11.1a) - the browser cannot resolve
// DNS itself, so this only recognizes literal local hostnames/IPs. The
// desktop's own security policy (apps/desktop/src/security) is the
// authoritative check once a request is actually routed there; anything
// this heuristic misses still reaches the target via the toggle in
// request-editor.tsx or simply keeps using the server proxy.
const allowedLocalRanges = new Set([
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "carrierGradeNat",
]);

export function isLikelyLocalTarget(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    return true;
  }
  if (!ipaddr.isValid(hostname)) return false;
  return allowedLocalRanges.has(ipaddr.process(hostname).range());
}
