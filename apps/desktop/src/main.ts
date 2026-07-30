import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  protocol,
  session,
} from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  desktopSettingsSchema,
  type DesktopSettings,
  validateServerUrl,
} from "./settings.js";

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

function settingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
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
  settings = { serverUrl };
  await writeFile(settingsPath(), JSON.stringify(settings), {
    encoding: "utf8",
    mode: 0o600,
  });
  return serverUrl;
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
  void window.loadURL("app://devapi/");
  return window;
}

await app.whenReady();
app.setAppUserModelId("de.devapi.relay");
settings = await loadSettings();
protocol.handle("app", handleAppRequest);
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
  callback(false);
});
ipcMain.handle("desktop:get-server-url", () => settings?.serverUrl ?? null);
ipcMain.handle("desktop:set-server-url", async (_event, value: unknown) => {
  const serverUrl = await saveServerUrl(value);
  for (const window of BrowserWindow.getAllWindows()) window.reload();
  return serverUrl;
});
createWindow();

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
