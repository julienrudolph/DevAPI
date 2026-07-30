import { buildProxyApp } from "./app.js";

const port = Number(process.env.PROXY_PORT ?? 3002);
const host = process.env.PROXY_HOST ?? "127.0.0.1";
const app = buildProxyApp();

await app.listen({ host, port });
