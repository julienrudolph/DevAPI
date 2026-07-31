import { buildProxyApp } from "./app.js";

const port = Number(process.env.PROXY_PORT ?? 3002);
const host = process.env.PROXY_HOST ?? "127.0.0.1";
const maxConcurrentRequests = Number(
  process.env.PROXY_MAX_CONCURRENT_REQUESTS ?? 50,
);
const metricsToken =
  process.env.METRICS_TOKEN || process.env.PROXY_INTERNAL_TOKEN;
if (!metricsToken || metricsToken.length < 32) {
  throw new Error("METRICS_TOKEN muss mindestens 32 Zeichen lang sein.");
}
if (
  !Number.isInteger(maxConcurrentRequests) ||
  maxConcurrentRequests < 1 ||
  maxConcurrentRequests > 1_000
) {
  throw new Error("PROXY_MAX_CONCURRENT_REQUESTS muss zwischen 1 und 1000 liegen.");
}
const app = buildProxyApp({
  logger: true,
  maxConcurrentRequests,
  metricsToken,
});

await app.listen({ host, port });
