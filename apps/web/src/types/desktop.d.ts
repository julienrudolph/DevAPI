interface DevApiDesktopBridge {
  getServerUrl(): Promise<string | null>;
  setServerUrl(serverUrl: string): Promise<string>;
  platform: NodeJS.Platform;
}

interface Window {
  devapiDesktop?: DevApiDesktopBridge;
}
