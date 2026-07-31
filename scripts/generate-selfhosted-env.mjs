import { createHmac, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(".env.selfhosted");
const siteUrlArgument = process.argv.find((argument) =>
  argument.startsWith("http"),
);
const dataDirectoryArgument = process.argv.find((argument) =>
  argument.startsWith("/"),
);
const force = process.argv.includes("--force");

if (!siteUrlArgument) {
  console.error(
    "Aufruf: npm run compose:selfhosted:env -- https://devapi.example.de /srv/devapi/data",
  );
  process.exit(1);
}
if (!dataDirectoryArgument || dataDirectoryArgument === "/") {
  console.error("Ein absolutes, nicht-root Datenverzeichnis ist erforderlich.");
  process.exit(1);
}

let siteUrl;
try {
  siteUrl = new URL(siteUrlArgument);
} catch {
  console.error("Die öffentliche URL ist ungültig.");
  process.exit(1);
}

if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
  console.error("Für den Serverbetrieb ist eine HTTPS-URL erforderlich.");
  process.exit(1);
}

siteUrl.pathname = "";
siteUrl.search = "";
siteUrl.hash = "";
const normalizedSiteUrl = siteUrl.toString().replace(/\/$/, "");

if (existsSync(target) && !force) {
  console.error(
    ".env.selfhosted existiert bereits. --force würde Datenbankzugänge und alle bestehenden Sessions ungültig machen.",
  );
  process.exit(1);
}

const jwtSecret = randomBytes(48).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const anonKey = signJwt(
  {
    role: "anon",
    iss: "supabase",
    iat: now,
    exp: now + 10 * 365 * 24 * 60 * 60,
  },
  jwtSecret,
);

const content = `NPM_NETWORK=botnet
DEVAPI_DATA_DIR=${dataDirectoryArgument.replace(/\/$/, "")}

PUBLIC_HOST=${siteUrl.hostname}
SITE_URL=${normalizedSiteUrl}
SUPABASE_PUBLIC_URL=${normalizedSiteUrl}
SUPABASE_INTERNAL_URL=http://supabase-gateway:8000

POSTGRES_PASSWORD=${randomBytes(32).toString("base64url")}
JWT_SECRET=${jwtSecret}
SUPABASE_PUBLISHABLE_KEY=${anonKey}
PROXY_INTERNAL_TOKEN=${randomBytes(48).toString("base64url")}

PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
AUTH_DISABLE_SIGNUP=false
AUTH_AUTOCONFIRM=true

OIDC_PROVIDER=
OIDC_LABEL=Mit Firmenkonto anmelden

SMTP_ADMIN_EMAIL=devapi@localhost
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_USER=
SMTP_PASS=
SMTP_SENDER_NAME=DevAPI

BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30
`;

writeFileSync(target, content, { encoding: "utf8", mode: 0o600 });
console.log(".env.selfhosted wurde mit zufälligen Secrets erstellt.");

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}
