const { contextBridge, ipcRenderer } = require("electron");

const pendingAuthCallbacks = [];
const authCallbackListeners = new Set();
ipcRenderer.on("desktop:auth-callback", (_event, url) => {
  if (authCallbackListeners.size === 0) {
    pendingAuthCallbacks.push(url);
    return;
  }
  for (const listener of authCallbackListeners) listener(url);
});

contextBridge.exposeInMainWorld("devapiDesktop", {
  getServerUrl: () => ipcRenderer.invoke("desktop:get-server-url"),
  setServerUrl: (serverUrl) =>
    ipcRenderer.invoke("desktop:set-server-url", serverUrl),
  sessionStorage: {
    getItem: (key) => ipcRenderer.invoke("desktop:session-get", key),
    setItem: (key, value) =>
      ipcRenderer.invoke("desktop:session-set", key, value),
    removeItem: (key) => ipcRenderer.invoke("desktop:session-remove", key),
  },
  openAuthUrl: (url) => ipcRenderer.invoke("desktop:open-auth-url", url),
  executeLocalRequest: (request) =>
    ipcRenderer.invoke("desktop:execute-local-request", request),
  onAuthCallback: (callback) => {
    authCallbackListeners.add(callback);
    for (const url of pendingAuthCallbacks.splice(0)) callback(url);
    return () => authCallbackListeners.delete(callback);
  },
  platform: process.platform,
});
