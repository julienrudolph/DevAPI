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

Der Standard-Serverbetrieb ist vollständig selbst gehostet. PostgreSQL,
Supabase Auth, PostgREST, DevAPI-Web, API und Request-Proxy laufen als
Container auf demselben Server. Es wird weder ein Supabase-Cloudkonto noch
eine andere Cloud-Datenbank benötigt.

Das vorhandene Nginx-Proxy-Manager-Netzwerk heißt standardmäßig `botnet`.
Nur der Web-Container wird damit verbunden. Datenbank, Auth, PostgREST, API
und Request-Proxy bleiben im privaten Docker-Netz.

### 1. Voraussetzungen

- Linux-Server mit Docker Engine und Docker Compose
- mindestens 4 GB RAM, empfohlen 8 GB
- mindestens 40 GB SSD, empfohlen 80 GB
- Git
- Node.js 22 und npm zum komfortablen Erzeugen der Konfiguration
- vorhandener Nginx Proxy Manager im externen Docker-Netz `botnet`

Von außen werden nur die bereits durch Nginx Proxy Manager belegten Ports 80
und 443 benötigt. PostgreSQL und die internen APIs erhalten keine Host-Ports.

### 2. Projekt und Konfiguration

```bash
git clone <REPOSITORY-URL> devapi
cd devapi
npm run compose:selfhosted:env -- https://devapi.example.de
```

Der letzte Befehl erzeugt `.env.selfhosted` mit zufälligem
Datenbankpasswort, JWT-Secret, öffentlichem Anwendungs-Key und internem
Proxy-Token. Die Datei ist nicht für Git vorgesehen:

```bash
chmod 600 .env.selfhosted
```

Falls das externe Netzwerk anders heißt, `NPM_NETWORK` in
`.env.selfhosted` anpassen. Das Skript darf nach der Inbetriebnahme nicht mit
`--force` erneut ausgeführt werden, weil neue Schlüssel bestehende Sessions
und Datenbankzugänge ungültig machen.

### 3. Stack prüfen und starten

```bash
docker network inspect botnet
npm run compose:selfhosted:config
npm run compose:selfhosted:up
```

Beim ersten Start werden PostgreSQL und Auth initialisiert. Der einmalige
`migrate`-Container wendet alle noch fehlenden Dateien aus
`supabase/migrations` automatisch in aufsteigender Zeitstempel-Reihenfolge an.
Es sind weder Supabase CLI noch manuelle SQL-Befehle erforderlich.

### 4. Nginx Proxy Manager

Einen Proxy Host anlegen:

| Feld | Wert |
|---|---|
| Domain Names | `devapi.example.de` |
| Scheme | `http` |
| Forward Hostname / IP | `devapi-web` |
| Forward Port | `8080` |
| Block Common Exploits | aktiv |
| Websockets Support | aktiv |

Unter **SSL** das Zertifikat auswählen beziehungsweise anfordern, **Force
SSL** und **HTTP/2 Support** aktivieren. Es werden keine zusätzlichen Proxy
Hosts oder Location-Regeln für Auth beziehungsweise PostgREST benötigt:
`/auth/v1` und `/rest/v1` werden vom Web-Container intern weitergeleitet.

### 5. Authentifizierung

Es gibt bei Self-Hosting keine Supabase-Cloudoberfläche für die
Auth-Konfiguration. Die Einstellungen liegen in `.env.selfhosted`.
Standardmäßig gelten:

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
AUTH_DISABLE_SIGNUP=false
AUTH_AUTOCONFIRM=true
```

Damit funktionieren Registrierung und Anmeldung per E-Mail und Passwort ohne
Mailserver. E-Mail-Adressen werden dabei nicht verifiziert. Passwort-Reset,
Magic Links und Einladungsmails benötigen später einen erreichbaren
SMTP-Server.

### 6. Deployment prüfen

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
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  ps
```

Logs ansehen:

```bash
docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
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

Ohne SMTP müssen zusätzliche Konten über Selbstregistrierung angelegt werden.

### 7. Aktualisieren

Vor jedem Update zuerst die PostgreSQL-Daten sichern. Danach:

```bash
git pull --ff-only
npm run compose:selfhosted:config
npm run compose:selfhosted:up
```

Neue Migrationen müssen vor dem Start der davon abhängigen Anwendung in
einer getrennten Testinstallation geprüft werden. Der `migrate`-Container
wendet sie beim Start automatisch an.

### 8. Stoppen

```bash
npm run compose:selfhosted:down
```

Das Datenvolume `devapi_devapi-db-data` bleibt dabei erhalten. `down -v` würde
es löschen und darf im normalen Betrieb nicht verwendet werden.

### 9. Backups und Offline-Betrieb

Der Betreiber ist selbst für Backups, Updates und Wiederherstellung
verantwortlich. Empfohlen werden:

- täglicher PostgreSQL-Dump
- 14 bis 30 Tage Aufbewahrung
- verschlüsselte Kopie außerhalb des App-Servers
- regelmäßiger Restore-Test
- Überwachung von HTTPS, Container-Healthchecks und freiem Speicher
- Log-Rotation mit begrenzter Aufbewahrung

Im laufenden Betrieb baut DevAPI keine Verbindung zur Supabase-Plattform auf.
Für die erstmalige Installation müssen jedoch Images und Quellcode bezogen
werden. Für einen physisch vom Internet getrennten Betrieb müssen die
Container-Images und das Repository vorher in das Zielnetz übertragen werden.
Ein Let's-Encrypt-Zertifikat benötigt ebenfalls Internetzugang; vollständig
isolierte Netze verwenden stattdessen ein Zertifikat der eigenen CA.

Die ausführliche Betriebs-, Sicherheits- und Rollback-Anleitung steht in
[`docs/self-hosted-deployment.md`](docs/self-hosted-deployment.md).

Das sichere Electron-Grundgerüst und der geplante Windows-Build sind in
`docs/desktop.md` dokumentiert.

Die verbindlichen Produkt- und Entwicklungsregeln stehen in `AGENTS.md`.
