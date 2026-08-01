import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(packageDirectory, "src/preload.cjs");
const target = resolve(packageDirectory, "dist/preload.cjs");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
