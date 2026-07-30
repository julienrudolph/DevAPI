import { z } from "zod";

export const desktopSettingsSchema = z.object({
  serverUrl: z.string().url().transform((value) => value.replace(/\/+$/, "")),
});

export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;

export function validateServerUrl(
  value: string,
  allowInsecureLocalhost = false,
): string {
  const parsed = new URL(value);
  if (parsed.username || parsed.password) {
    throw new Error("Zugangsdaten dürfen nicht Teil der Serveradresse sein.");
  }
  const local =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(allowInsecureLocalhost && local)) {
    throw new Error("Der Server muss über HTTPS erreichbar sein.");
  }
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}
