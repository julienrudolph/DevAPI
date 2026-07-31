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

Die Standardkonfiguration verwendet E-Mail-Adresse und Passwort:

- Passwort-Anmeldung ist aktiviert.
- Selbstregistrierung ist aktiviert.
- neue Passwörter benötigen in der Oberfläche mindestens 12 Zeichen.
- Magic Link ist deaktiviert.
- OIDC kann zusätzlich aktiviert werden.

Damit kann ein interner Testserver ohne eigenen Mailserver verwendet werden.
Ohne SMTP stehen allerdings keine Passwort-Wiederherstellung,
E-Mail-Verifikation, Magic Links oder Einladungsmails zur Verfügung.

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
```

Provider-Secrets gehören niemals ins Frontend. Details enthält
`docs/authentication.md`.

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

Ausführliche Hinweise für lokale Tests stehen in `docs/docker.md`.

## Auf einem Server deployen

Der derzeit unterstützte Produktionsaufbau verwendet:

- einen Linux-Server mit Docker Compose
- eine Domain für DevAPI
- Caddy für HTTPS
- Hosted Supabase für Datenbank, Auth und PostgREST

Der lokale Supabase-Stack aus `compose.local.yaml` ist nicht für einen
öffentlichen Server gedacht. Er enthält unter anderem einen lokalen
Mail-Capture-Dienst.

### 1. Server und DNS vorbereiten

Empfohlene Mindestgröße:

```text
2 CPU-Kerne
4 GB RAM
20 GB freier Speicher
```

Auf dem Server werden benötigt:

```text
Docker Engine
Docker Compose Plugin
Git
optional Node.js >= 22.22 und npm >= 11
```

Für die gewünschte Domain, beispielsweise `devapi.example.de`, einen
DNS-A-Record auf die öffentliche IPv4-Adresse des Servers setzen. Bei
vorhandenem IPv6 zusätzlich einen AAAA-Record setzen.

In der Firewall nur diese öffentlichen Ports für DevAPI freigeben:

```text
80/tcp
443/tcp
443/udp optional für HTTP/3
```

Die Ports von API, Proxy und Datenbank dürfen nicht öffentlich freigegeben
werden.

### 2. Projekt auf den Server übertragen

Repository klonen oder den freigegebenen Quellstand auf den Server kopieren:

```bash
git clone <REPOSITORY-URL> devapi
cd devapi
```

Für spätere Updates sollte der Server auf einem bekannten Commit oder Release
stehen, nicht auf einem beliebigen Zwischenstand.

### 3. Supabase vorbereiten

Die Produktionskonfiguration verwendet standardmäßig ein Projekt auf der
Supabase-Plattform. Beim Erstellen dieses Projekts stellt Supabase bereits
PostgreSQL, Auth und die API bereit. Auf dem DevAPI-Server muss deshalb kein
zusätzlicher PostgreSQL- oder Supabase-Container gestartet werden.

Soll Supabase einschließlich PostgreSQL stattdessen vollständig auf demselben
Server betrieben werden, ist dafür ein eigener produktionsgeeigneter
Self-Hosting-Stack erforderlich. `compose.local.yaml` startet zwar lokale
Supabase-Dienste für Entwicklung und Tests, ist aber nicht als öffentlich
erreichbare Produktionsdatenbank gehärtet. Dieser alternative Betriebsweg ist
noch nicht Bestandteil der folgenden Anleitung.

1. Unter [database.new](https://database.new/) ein Supabase-Projekt erstellen.
   Das dabei vergebene Datenbankpasswort sicher aufbewahren.
2. Die **Project ID** beziehungsweise **Project Reference** notieren. Sie steht
   in der Dashboard-URL hinter `/project/`, zum Beispiel:

   ```text
   https://supabase.com/dashboard/project/abcdefghijklmnopqrst
                                          ^^^^^^^^^^^^^^^^^^^^
                                          Project Reference
   ```

3. Die Migrationen mit der Supabase CLI einspielen. Diese Befehle werden in
   einem Terminal im Wurzelordner des geklonten DevAPI-Projekts ausgeführt –
   dort, wo `README.md`, `compose.yaml` und der Ordner `supabase/` liegen:

   ```bash
   cd /pfad/zu/DevAPI
   npx supabase init
   npx supabase login
   npx supabase link --project-ref <PROJECT_REFERENCE>
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Auf einem Server ohne grafischen Browser kann stattdessen
   `npx supabase login --no-browser` verwendet werden. `link` fragt
   gegebenenfalls nach dem Datenbankpasswort des Supabase-Projekts.

   `db push --dry-run` zeigt zuerst nur an, was ausgeführt würde. Der
   anschließende Befehl wendet alle noch fehlenden Dateien aus
   `supabase/migrations` automatisch in aufsteigender Reihenfolge an.
   „Aufsteigend“ bezieht sich auf den Zeitstempel am Anfang des Dateinamens:

   ```text
   20260728170000_initial_requests.sql
   20260729133000_harden_request_rpc.sql
   20260729150000_workspace_navigation.sql
   ...
   ```

   Die kleinste beziehungsweise älteste Nummer wird zuerst ausgeführt. Die
   Dateien nicht einzeln im SQL Editor einfügen; die CLI führt zusätzlich eine
   Migrationshistorie und überspringt bereits angewendete Migrationen.

4. Im Supabase Dashboard das Projekt öffnen und zu
   **Authentication → URL Configuration** wechseln.
5. Unter **Site URL** `https://devapi.example.de` eintragen.
6. Unter **Redirect URLs** über **Add URL**
   `https://devapi.example.de/auth/confirm` ergänzen und speichern.
7. Unter **Authentication → Sign In / Providers → Email** die
   E-Mail-/Passwort-Anmeldung aktivieren.
8. Für einen internen Testserver ohne SMTP dort **Confirm Email**
   deaktivieren.
9. Optional den Custom-OIDC-Provider einrichten.
10. Unter **Project Settings → API Keys** den öffentlichen Publishable Key
    notieren.

Die CLI kann ebenso auf einem administrativen Rechner ausgeführt werden. Es
muss lediglich derselbe Repository-Stand vorhanden sein und eine Verbindung
zur Supabase-Plattform bestehen. Sie muss nicht zwingend auf dem
Anwendungsserver laufen.

Für einen öffentlichen Produktivbetrieb sollte `Confirm Email` aktiviert und
ein SMTP-Dienst eingerichtet werden. Ohne Bestätigung behandelt Supabase die
angegebene E-Mail-Adresse ungeprüft als bestätigt.

OIDC-Client-Secret, Datenbankpasswort und Service-Role-Key gehören niemals in
die Web- oder Desktop-Konfiguration.

### 4. Produktionskonfiguration anlegen

Vorlage kopieren:

```bash
cp .env.production.example .env.production
```

Einen sicheren internen Proxy-Token erzeugen:

```bash
openssl rand -hex 32
```

Danach `.env.production` bearbeiten:

```text
PUBLIC_HOST=devapi.example.de
ACME_EMAIL=admin@example.de
SITE_URL=https://devapi.example.de

SUPABASE_PUBLIC_URL=https://PROJECT.supabase.co
SUPABASE_INTERNAL_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

PROXY_INTERNAL_TOKEN=<Ausgabe von openssl rand -hex 32>

OIDC_PROVIDER=
OIDC_LABEL=Mit Firmenkonto anmelden

PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
```

`PUBLIC_HOST` enthält nur den Hostnamen und kein `https://`. Die Site- und
Supabase-URLs enthalten dagegen das Protokoll.

Die Auth-Schalter steuern die sichtbaren Optionen:

| Einstellung | Bedeutung |
|---|---|
| `PASSWORD_AUTH_ENABLED=true` | Anmeldung mit E-Mail und Passwort |
| `PASSWORD_SIGNUP_ENABLED=true` | Nutzer dürfen selbst Konten erstellen |
| `MAGIC_LINK_AUTH_ENABLED=false` | keine Anmeldemails erforderlich |

Für einen späteren geschlossenen Produktivbetrieb ist beispielsweise möglich:

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=false
MAGIC_LINK_AUTH_ENABLED=false
OIDC_PROVIDER=custom:company-oidc
```

`.env.production` ist nicht für Git vorgesehen. Die Datei muss auf dem Server
nur für den Betriebsbenutzer lesbar sein:

```bash
chmod 600 .env.production
```

### 5. Konfiguration prüfen

Mit installiertem npm:

```bash
npm run compose:production:config
```

Alternativ nur mit Docker Compose:

```bash
docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  config --quiet
```

Der Befehl darf keine Warnung über fehlende Variablen ausgeben.

### Alternative: vorhandener Nginx Proxy Manager

Wenn auf dem Server bereits Nginx Proxy Manager läuft, wird Caddy nicht
benötigt. Das Overlay `compose.npm-proxy.yaml` verbindet ausschließlich den
Web-Container zusätzlich mit dem vorhandenen externen Docker-Netzwerk. API und
Request-Proxy bleiben im privaten DevAPI-Netz und veröffentlichen keine Ports.

Für ein Nginx-Proxy-Manager-Netz namens `botnet` bleibt in
`.env.production`:

```text
NPM_NETWORK=botnet
```

Das Netzwerk und die Mitgliedschaft des Nginx Proxy Managers prüfen:

```bash
docker network inspect botnet
```

Danach DevAPI ohne Caddy starten:

```bash
npm run compose:npm-proxy:config
npm run compose:npm-proxy:up
```

Im Nginx Proxy Manager einen Proxy Host anlegen:

| Feld | Wert |
|---|---|
| Domain Names | `devapi.example.de` |
| Scheme | `http` |
| Forward Hostname / IP | `devapi-web` |
| Forward Port | `8080` |
| Block Common Exploits | aktiv |
| Websockets Support | aktiv |

Unter **SSL** das Zertifikat auswählen beziehungsweise anfordern, **Force
SSL** und **HTTP/2 Support** aktivieren. HSTS erst aktivieren, nachdem HTTPS
zuverlässig funktioniert. Die öffentliche Supabase Site URL und Redirect-URL
müssen weiterhin `https://devapi.example.de` verwenden.

Wichtig: Nicht gleichzeitig `compose.production.yaml` verwenden. Dieses
Overlay startet Caddy und würde die öffentlichen Ports 80 und 443 belegen.
Die ausführliche Einbindung einschließlich Firewall- und Update-Hinweisen
steht in
[`docs/nginx-proxy-manager.md`](docs/nginx-proxy-manager.md).

### 6. Anwendung starten

Mit npm:

```bash
npm run compose:production:up
```

Oder direkt:

```bash
docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  up -d --build --wait
```

Caddy fordert automatisch ein TLS-Zertifikat an. Dafür müssen DNS sowie Port
80 und 443 bereits korrekt konfiguriert sein.

### 7. Deployment prüfen

Diese Adressen müssen ohne Zertifikatswarnung erreichbar sein:

```text
https://devapi.example.de/healthz
https://devapi.example.de/api/health
https://devapi.example.de/api/v1/config
```

Der Konfigurationsendpunkt darf nur öffentliche Werte liefern. Insbesondere
dürfen dort weder `PROXY_INTERNAL_TOKEN` noch Datenbank- oder OIDC-Secrets
erscheinen.

Containerstatus prüfen:

```bash
docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  ps
```

Logs ansehen:

```bash
docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  logs --tail=200
```

Anschließend mindestens manuell testen:

1. Registrierung mit E-Mail und Passwort
2. Abmelden und erneut mit Passwort anmelden
3. optional OIDC-Anmeldung
4. Workspace öffnen
5. Request speichern
6. Request ausführen
7. Zugriff mit einem Nutzer aus einem anderen Team ablehnen

Ohne SMTP kann eine Einladungsmail nicht zugestellt werden. Zusätzliche Konten
müssen für den Testbetrieb deshalb zunächst über Selbstregistrierung angelegt
werden.

### 8. Anwendung aktualisieren

Vor einem Update zuerst ein Supabase-Datenbankbackup erstellen. Danach:

```bash
git pull --ff-only
npm run compose:production:config
npm run compose:production:up
```

Neue Migrationen müssen vor dem Start der davon abhängigen Anwendung in
Staging geprüft und anschließend auf das Produktionsprojekt angewendet werden.

### 9. Anwendung stoppen

```bash
npm run compose:production:down
```

Das entfernt die laufenden App-Container und Netzwerke, aber nicht automatisch
die Caddy-Volumes. Fachliche Workspace-Daten liegen im konfigurierten
Supabase-Projekt.

### 10. Backups und Betrieb

Für Hosted Supabase sollten automatische Backups aktiviert werden. Zusätzlich
empfohlen:

- tägliche Sicherung
- 14 bis 30 Tage Aufbewahrung
- verschlüsselte Kopie außerhalb des App-Servers
- regelmäßiger Restore-Test
- Überwachung von HTTPS, Container-Healthchecks und freiem Speicher
- Log-Rotation mit begrenzter Aufbewahrung

Die ausführliche Betriebs-, Sicherheits- und Rollback-Anleitung steht in
[`docs/production-deployment.md`](docs/production-deployment.md).

Das sichere Electron-Grundgerüst und der geplante Windows-Build sind in
`docs/desktop.md` dokumentiert.

Die verbindlichen Produkt- und Entwicklungsregeln stehen in `AGENTS.md`.
