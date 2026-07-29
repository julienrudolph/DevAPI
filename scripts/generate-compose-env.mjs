import { createHmac, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const target = resolve(".env.compose");
const force = process.argv.includes("--force");

if (existsSync(target) && !force) {
  console.error(
    ".env.compose existiert bereits. Nutze --force nur, wenn lokale Daten und Tokens bewusst ungültig werden dürfen.",
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

const content = `WEB_BIND_ADDRESS=127.0.0.1
WEB_HOST_PORT=8080
API_HOST_PORT=3001
PROXY_HOST_PORT=3002
POSTGRES_HOST_PORT=54322
SUPABASE_HOST_PORT=8000
MAIL_HOST_PORT=9000

SITE_URL=http://localhost:8080
SUPABASE_PUBLIC_URL=http://localhost:8000
SUPABASE_INTERNAL_URL=http://supabase-gateway:8000

POSTGRES_PASSWORD=${randomBytes(32).toString("base64url")}
JWT_SECRET=${jwtSecret}
SUPABASE_PUBLISHABLE_KEY=${anonKey}
PROXY_INTERNAL_TOKEN=${randomBytes(48).toString("base64url")}

OIDC_PROVIDER=
OIDC_LABEL=Mit Firmenkonto anmelden
`;

writeFileSync(target, content, { encoding: "utf8", mode: 0o600 });
console.log(".env.compose wurde mit zufälligen lokalen Secrets erstellt.");

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
