export function parseAuthCallback(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== "devapi:" ||
    url.hostname !== "auth" ||
    url.port !== "" ||
    url.pathname !== "/callback" ||
    (url.username || url.password)
  ) {
    return undefined;
  }
  return url.toString();
}

export function validateAuthStartUrl(
  value: string,
  serverUrl: string,
): string {
  const url = new URL(value);
  const server = new URL(serverUrl);
  if (
    url.protocol !== server.protocol ||
    url.host !== server.host ||
    !url.pathname.startsWith("/auth/v1/authorize") ||
    url.username ||
    url.password
  ) {
    throw new Error("AUTH_URL_INVALID");
  }
  return url.toString();
}
