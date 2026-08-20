import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

// npm workspaces hoist every dependency (including workspace packages like
// @api-client/contracts) to the repo root's node_modules. electron-packager
// only copies node_modules relative to apps/desktop itself, which has none
// - so a packaged app that merely transpiled main.ts per-file (plain tsc)
// would fail at runtime with ERR_MODULE_NOT_FOUND for every such dependency
// (contracts, undici, ipaddr.js). Bundling main.ts into one self-contained
// file removes that runtime resolution step entirely; only "electron"
// itself stays external, since the Electron runtime provides it natively.
const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [resolve(packageDirectory, "src/main.ts")],
  outfile: resolve(packageDirectory, "dist/main.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
});
