const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("devapiDesktop", {
  getServerUrl: () => ipcRenderer.invoke("desktop:get-server-url"),
  setServerUrl: (serverUrl) =>
    ipcRenderer.invoke("desktop:set-server-url", serverUrl),
  platform: process.platform,
});
