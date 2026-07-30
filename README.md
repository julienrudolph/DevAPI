# Collaborative API Client

Ein schlanker, kollaborativer REST-API-Client für gemeinsame Team-Workspaces.

## Projektstatus

Das Projekt befindet sich im Aufbau. Der interne MVP umfasst inzwischen
gemeinsame Team-Workspaces, Rollen und Einladungen, den REST-Request-Editor,
Umgebungsvariablen, die abgesicherte Proxy-Ausführung, Konflikterkennung,
Revisionen und eine datensparsame Ausführungshistorie.

## Voraussetzungen

- Node.js 22 oder neuer
- npm 11 oder neuer

## Lokaler Start

```bash
npm install
npm run dev
```

Weitere Dienste:

```bash
npm run dev:api
npm run dev:proxy
```

Für die API werden `SUPABASE_URL`, `PUBLIC_SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`,
`PROXY_INTERNAL_URL` und derselbe `PROXY_INTERNAL_TOKEN` benötigt.
Die API verwendet bewusst keinen Service-Role-Schlüssel: Sie validiert den
Supabase-Bearer-Token und führt Datenbankoperationen mit der jeweiligen
Benutzersitzung aus, damit RLS durchgesetzt wird.

Der Proxy benötigt für Ausführungsaufrufe einen internen Service-Token:

```bash
PROXY_INTERNAL_TOKEN="lokaler-nur-für-die-entwicklung-token" npm run dev:proxy
```

Der Browser soll diesen Token später nicht erhalten. Die fachliche API prüft den
Supabase-Nutzer und ruft den isolierten Proxy anschließend serverseitig auf.

## Authentifizierung

Die Web-App unterstützt Supabase-E-Mail-Login und optional einen über Supabase
konfigurierten Custom-OIDC-Provider. Die benötigten öffentlichen Variablen
stehen in `.env.example`; Provider-Secrets gehören niemals ins Frontend.
Details enthält `docs/authentication.md`.

Alle Prüfungen:

```bash
npm run check
```

Die vollständige lokale CI-Prüfung einschließlich der
Docker-Compose-Konfiguration:

```bash
npm run verify
```

Bei Pushes auf `main` und in Pull Requests führt GitHub Actions dieselben
Prüfungen mit der in `.nvmrc` festgelegten Node.js-Version aus. Zusätzlich
werden Produktionsabhängigkeiten auf bekannte Schwachstellen hoher oder
kritischer Schwere geprüft.

## Docker

Ein lokaler Integrationsstack mit Web, API, Proxy, Supabase Auth, PostgREST,
PostgreSQL, Migrationen und Mail-Capture kann so gestartet werden:

```bash
npm run compose:env
npm run compose:up
```

Ausführliche Hinweise für lokale Tests, Hosted Supabase und einen späteren
Rollout stehen in `docs/docker.md`.

Eine produktionsnahe Einzelserver-Installation mit HTTPS, privaten
Dienstports und zur Laufzeit geladener Clientkonfiguration ist in
`docs/production-deployment.md` beschrieben.

Das sichere Electron-Grundgerüst und der geplante Windows-Build sind in
`docs/desktop.md` dokumentiert.

Die verbindlichen Produkt- und Entwicklungsregeln stehen in `AGENTS.md`.
