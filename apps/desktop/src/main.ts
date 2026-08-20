import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  safeStorage,
  session,
  shell,
} from "electron";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  executeRequestSchema,
  type LocalExecutionResult,
} from "@api-client/contracts";

import { parseAuthCallback, validateAuthStartUrl } from "./auth.js";
import {
  RedirectLimitError,
  ResponseTooLargeError,
  executeLocalHttpRequest,
} from "./execution/local-executor.js";
import { localUndiciTransport } from "./execution/local-transport.js";
import {
  desktopSettingsSchema,
  type DesktopSettings,
  validateServerUrl,
} from "./settings.js";
import { UnsafeHeaderError } from "./security/headers.js";
import { UnsafeLocalTargetError } from "./security/local-target-policy.js";
import {
  parseResolvedProxyString,
  readUpstreamProxyConfig,
  selectUpstreamProxy,
} from "./security/proxy-config.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let settings: DesktopSettings | undefined;
let mainWindow: BrowserWindow | undefined;
let pendingAuthCallback: string | undefined;
let sessionStorageUpdate = Promise.resolve();

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function sessionPath(): string {
  return path.join(app.getPath("userData"), "auth-session.bin");
}

async function readSessionStorage(): Promise<Record<string, string>> {
  if (!sessionEncryptionAvailable()) return {};
  try {
    const encrypted = await readFile(sessionPath());
    const parsed: unknown = JSON.parse(safeStorage.decryptString(encrypted));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !Object.values(parsed).every((value) => typeof value === "string")
    ) {
      return {};
    }
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

function sessionEncryptionAvailable(): boolean {
  return (
    safeStorage.isEncryptionAvailable() &&
    !(
      process.platform === "linux" &&
      safeStorage.getSelectedStorageBackend() === "basic_text"
    )
  );
}

async function writeSessionStorage(values: Record<string, string>): Promise<void> {
  if (!sessionEncryptionAvailable()) {
    throw new Error("SESSION_ENCRYPTION_UNAVAILABLE");
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(values));
  await writeFile(sessionPath(), encrypted, { mode: 0o600 });
}

async function updateSessionStorage(
  key: unknown,
  value?: unknown,
): Promise<void> {
  if (typeof key !== "string" || key.length > 256) {
    throw new Error("SESSION_KEY_INVALID");
  }
  const values = await readSessionStorage();
  if (typeof value === "string") values[key] = value;
  else delete values[key];
  if (Object.keys(values).length === 0) {
    await unlink(sessionPath()).catch(() => undefined);
  } else {
    await writeSessionStorage(values);
  }
}

function enqueueSessionStorageUpdate(
  key: unknown,
  value?: unknown,
): Promise<void> {
  const update = sessionStorageUpdate.then(() =>
    updateSessionStorage(key, value),
  );
  sessionStorageUpdate = update.catch(() => undefined);
  return update;
}

async function loadSettings(): Promise<DesktopSettings | undefined> {
  const environmentUrl = process.env.DEVAPI_SERVER_URL;
  if (environmentUrl) {
    return {
      serverUrl: validateServerUrl(environmentUrl, !app.isPackaged),
    };
  }
  try {
    return desktopSettingsSchema.parse(
      JSON.parse(await readFile(settingsPath(), "utf8")),
    );
  } catch {
    return undefined;
  }
}

async function saveServerUrl(value: unknown): Promise<string> {
  if (typeof value !== "string") throw new Error("SERVER_URL_INVALID");
  const serverUrl = validateServerUrl(value, !app.isPackaged);
  const previousServerUrl = settings?.serverUrl;
  settings = { serverUrl };
  await writeFile(settingsPath(), JSON.stringify(settings), {
    encoding: "utf8",
    mode: 0o600,
  });
  // A session token is only valid for the server that issued it. Carrying
  // it over to a different server would silently fail every request
  // instead of prompting a clean re-login, so drop it on an actual change.
  if (previousServerUrl && previousServerUrl !== serverUrl) {
    await enqueueClearSessionStorage();
  }
  return serverUrl;
}

function enqueueClearSessionStorage(): Promise<void> {
  const update = sessionStorageUpdate.then(() =>
    unlink(sessionPath()).catch(() => undefined),
  );
  sessionStorageUpdate = update;
  return update;
}

// AGENTS.md 11.1b: an explicit HTTP(S)_PROXY/NO_PROXY env var always wins
// (matches apps/proxy's behavior and is testable without Electron); absent
// that, ask Chromium's own network stack what it would use for this URL -
// the same PAC/WPAD/system detection that already makes the server
// connection proxy-aware for free, so local execution matches it without
// requiring separate IT configuration.
async function resolveProxyForLocalTarget(
  url: URL,
): Promise<string | undefined> {
  const envConfig = readUpstreamProxyConfig();
  if (envConfig.httpProxyUrl || envConfig.httpsProxyUrl) {
    // Explicit env config is authoritative once present (matches
    // curl/npm convention): its NO_PROXY can exclude a host from proxying
    // even if system/PAC detection would otherwise route it through one.
    return selectUpstreamProxy(envConfig, url);
  }

  try {
    const resolved = await session.defaultSession.resolveProxy(url.toString());
    return parseResolvedProxyString(resolved);
  } catch {
    return undefined;
  }
}

function localExecutionErrorCode(error: unknown): string {
  if (error instanceof UnsafeLocalTargetError) return "LOCAL_UNSAFE_TARGET";
  if (error instanceof UnsafeHeaderError) return "LOCAL_UNSAFE_HEADER";
  if (error instanceof RedirectLimitError) {
    return "LOCAL_REDIRECT_LIMIT_EXCEEDED";
  }
  if (error instanceof ResponseTooLargeError) {
    return "LOCAL_RESPONSE_TOO_LARGE";
  }
  return "LOCAL_EXECUTION_FAILED";
}

function webRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "dist")
    : path.resolve(app.getAppPath(), "../web/dist");
}

async function handleAppRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    if (!settings) {
      return Response.json(
        { code: "DESKTOP_SERVER_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    const target = new URL(
      `${url.pathname}${url.search}`,
      `${settings.serverUrl}/`,
    );
    return net.fetch(target.toString(), {
      method: request.method,
      headers: request.headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : request.body,
      redirect: "manual",
    });
  }

  const root = webRoot();
  const requestedPath =
    url.pathname === "/" || !path.extname(url.pathname)
      ? "index.html"
      : url.pathname.replace(/^\/+/, "");
  const localPath = path.resolve(root, requestedPath);
  if (!localPath.startsWith(`${path.resolve(root)}${path.sep}`)) {
    return new Response("Not found", { status: 404 });
  }
  return net.fetch(pathToFileURL(localPath).toString());
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: "#f6f8f6",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(app.getAppPath(), "dist/preload.cjs"),
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, destination) => {
    if (!destination.startsWith("app://devapi/")) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.once("did-finish-load", () => {
    if (pendingAuthCallback) {
      window.webContents.send("desktop:auth-callback", pendingAuthCallback);
      pendingAuthCallback = undefined;
    }
  });
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });
  void window.loadURL("app://devapi/");
  mainWindow = window;
  return window;
}

function forwardAuthCallback(value: string): void {
  const callback = parseAuthCallback(value);
  if (!callback) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("desktop:auth-callback", callback);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingAuthCallback = callback;
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const callback = commandLine.find((value) => parseAuthCallback(value));
    if (callback) forwardAuthCallback(callback);
  });
  app.on("open-url", (event, url) => {
    event.preventDefault();
    forwardAuthCallback(url);
  });

  await app.whenReady();
  app.setAppUserModelId("de.devapi.relay");
  app.setAsDefaultProtocolClient("devapi");
  settings = await loadSettings();
  protocol.handle("app", handleAppRequest);
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    },
  );
  ipcMain.handle("desktop:get-server-url", () => settings?.serverUrl ?? null);
  ipcMain.handle("desktop:set-server-url", async (_event, value: unknown) => {
    const serverUrl = await saveServerUrl(value);
    for (const window of BrowserWindow.getAllWindows()) window.reload();
    return serverUrl;
  });
  ipcMain.handle("desktop:session-get", async (_event, key: unknown) => {
    if (typeof key !== "string") throw new Error("SESSION_KEY_INVALID");
    await sessionStorageUpdate;
    return (await readSessionStorage())[key] ?? null;
  });
  ipcMain.handle(
    "desktop:session-set",
    async (_event, key: unknown, value: unknown) => {
      if (typeof value !== "string") throw new Error("SESSION_VALUE_INVALID");
      await enqueueSessionStorageUpdate(key, value);
    },
  );
  ipcMain.handle("desktop:session-remove", async (_event, key: unknown) => {
    await enqueueSessionStorageUpdate(key);
  });
  ipcMain.handle("desktop:open-auth-url", async (_event, value: unknown) => {
    if (!settings || typeof value !== "string") {
      throw new Error("AUTH_URL_INVALID");
    }
    await shell.openExternal(validateAuthStartUrl(value, settings.serverUrl));
  });
  ipcMain.handle(
    "desktop:execute-local-request",
    async (_event, value: unknown): Promise<LocalExecutionResult> => {
      const parsed = executeRequestSchema.safeParse(value);
      if (!parsed.success) {
        return {
          ok: false,
          code: "LOCAL_INVALID_REQUEST",
          message: "Die Anfrage ist ungültig.",
        };
      }
      try {
        const response = await executeLocalHttpRequest(parsed.data, {
          transport: localUndiciTransport,
          resolveProxy: resolveProxyForLocalTarget,
        });
        return { ok: true, response };
      } catch (error) {
        return {
          ok: false,
          code: localExecutionErrorCode(error),
          message:
            error instanceof Error ? error.message : "Unbekannter Fehler.",
        };
      }
    },
  );
  createWindow();
  const initialCallback = process.argv.find((value) =>
    parseAuthCallback(value),
  );
  if (initialCallback) forwardAuthCallback(initialCallback);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
