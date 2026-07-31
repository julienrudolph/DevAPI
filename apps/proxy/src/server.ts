import { buildProxyApp } from "./app.js";

const port = Number(process.env.PROXY_PORT ?? 3002);
const host = process.env.PROXY_HOST ?? "127.0.0.1";
const maxConcurrentRequests = Number(
  process.env.PROXY_MAX_CONCURRENT_REQUESTS ?? 50,
);
if (
  !Number.isInteger(maxConcurrentRequests) ||
  maxConcurrentRequests < 1 ||
  maxConcurrentRequests > 1_000
) {
  throw new Error("PROXY_MAX_CONCURRENT_REQUESTS muss zwischen 1 und 1000 liegen.");
}
const app = buildProxyApp({ maxConcurrentRequests });

await app.listen({ host, port });
