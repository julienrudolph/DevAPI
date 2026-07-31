interface DevApiDesktopBridge {
  getServerUrl(): Promise<string | null>;
  setServerUrl(serverUrl: string): Promise<string>;
  sessionStorage?: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  openAuthUrl?(url: string): Promise<void>;
  onAuthCallback?(callback: (url: string) => void): () => void;
  platform: NodeJS.Platform;
}

interface Window {
  devapiDesktop?: DevApiDesktopBridge;
}
