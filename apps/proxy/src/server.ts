import { buildProxyApp } from "./app.js";

const port = Number(process.env.PROXY_PORT ?? 3002);
const app = buildProxyApp();

await app.listen({ host: "127.0.0.1", port });
