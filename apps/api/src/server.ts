import { buildApp } from "./app.js";

const port = Number(process.env.API_PORT ?? 3001);
const app = buildApp();

await app.listen({ host: "127.0.0.1", port });
