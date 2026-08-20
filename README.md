# Collaborative API Client

Ein schlanker, kollaborativer REST-API-Client für gemeinsame Team-Workspaces.

Neue Entwickler beginnen mit [DEVELOPMENT.md](DEVELOPMENT.md). Die
verbindlichen Architektur- und Sicherheitsregeln stehen in
[AGENTS.md](AGENTS.md).

## Projektstatus

Das Projekt befindet sich im Aufbau. Der interne MVP umfasst inzwischen
gemeinsame Team-Workspaces, Rollen und Einladungen (inklusive Widerruf
offener Einladungen), den REST-Request-Editor, Umgebungsvariablen, die
abgesicherte Proxy-Ausführung, Konflikterkennung, Revisionen und eine
datensparsame Ausführungshistorie. OpenAPI-, Postman- und PowerShell-Import
(`Invoke-RestMethod`/`Invoke-WebRequest`), redigierter Workspace-Export sowie
JSON-, Text-, URL-encoded- und textbasierte Form-Data-Bodies sind ebenfalls
enthalten. Request-Revisionen werden pro Request auf die jüngsten 100
Einträge und höchstens 180 Tage begrenzt. Die Ausführungshistorie enthält
maximal 100 Einträge aus den letzten 30 Tagen.

Der Electron-Desktop-Client kann Requests gegen `localhost` und private
Netze wahlweise direkt im Main-Prozess ausführen, statt über den
Server-Proxy — mit automatischer Zielerkennung und einem expliziten Umschalter
pro Request. Änderungen an gemeinsam bearbeiteten Ressourcen werden per
Idempotenzschlüssel gegen doppelte Ausführung abgesichert, und Correlation-IDs
verbinden API- und Proxy-Logs für dieselbe Anfrage. Ein passiver
Aktualisierungshinweis zeigt an, wenn im Hintergrund eine neuere Version
vorliegt, ohne einen ungespeicherten Entwurf zu überschreiben. Team- und
Workspace-Löschung durch den Owner sowie die selbstständige, per
E-Mail-Bestätigung abgesicherte Löschung des eigenen Kontos sind ebenfalls
verfügbar (siehe AGENTS.md 7.4).

Die Weboberfläche ist mehrsprachig (Deutsch als Standard, zusätzlich
Englisch) und über einen Sprachumschalter im Kopfbereich umschaltbar. Weitere
Sprachen lassen sich durch eine zusätzliche Locale-Datei je Feature-Namespace
unter `apps/web/src/locales/<sprache>/` ergänzen.

## Voraussetzungen

- Node.js 22 oder neuer
- npm 11 oder neuer
- Docker Engine oder Docker Desktop
- Docker Compose

## Lokaler Start

```bash
npm ci
npm run compose:env
npm run compose:up
```

Danach ist die Anwendung unter `http://localhost:8080` erreichbar. Das lokale
Test-Postfach läuft unter `http://localhost:9000`.

```bash
npm run compose:down
```

Hot Reload, Einzelstart von Web/API/Proxy, Migrationen und Testkonventionen
sind in [DEVELOPMENT.md](DEVELOPMENT.md) beschrieben.

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

## Ausführungslimits

Der Server begrenzt ausgeführte Requests standardmäßig auf:

- 60 Starts pro Minute und Nutzer
- 300 Starts pro Minute und Workspace
- 3 gleichzeitig laufende Requests pro Nutzer
- 10 gleichzeitig laufende Requests pro Workspace
- 50 gleichzeitig laufende Requests im isolierten Proxy insgesamt

Bei Überschreitung antwortet die API mit HTTP `429` und einem
`Retry-After`-Header. Die Werte können über
`EXECUTION_RATE_*`, `EXECUTION_CONCURRENCY_*` und
`PROXY_MAX_CONCURRENT_REQUESTS` angepasst werden. Die nutzer- und
workspacebezogenen Zähler liegen im Speicher des API-Prozesses und sind damit
für den vorgesehenen einzelnen Self-Hosted-API-Container geeignet. Mehrere
API-Replikate benötigen später einen gemeinsamen verteilten Limiter.

Welche Prometheus-Metriken für die Nachjustierung dieser Limits relevant
sind und wie der empfohlene Review-Zyklus aussieht, steht in
[`docs/operations.md`](docs/operations.md).

## Unternehmens-Proxy

In Umgebungen, in denen ausgehender Internetverkehr nur über einen zentralen
Proxy erlaubt ist, unterstützt der isolierte Request-Ausführungs-Proxy einen
vorgeschalteten HTTP(S)-Proxy über die Standardvariablen:

```text
HTTP_PROXY=http://proxy.firma.example:8080
HTTPS_PROXY=http://proxy.firma.example:8443
NO_PROXY=localhost,.internes.firma.example
```

`NO_PROXY` nimmt kommagetrennte Hostnamen oder Domains entgegen (führender
Punkt oder eine nackte Domain deckt auch Subdomains ab) sowie `*`, um den
Proxy vollständig zu deaktivieren. Ist ein Proxy für ein Ziel aktiv, entfällt
für diesen Zielhost das IP-Pinning gegen DNS-Rebinding aus der
SSRF-Absicherung (AGENTS.md 11.1b) — die Sicherheitsgrenze verschiebt sich
dann auf den vertrauenswürdigen Unternehmens-Proxy selbst.

Der Electron-Desktop-Client unterstützt denselben Proxy zusätzlich für seine
lokale Ausführung gegen `localhost` und private Netze (11.1a): Ist explizit
`HTTP_PROXY`/`HTTPS_PROXY` gesetzt, gilt das; andernfalls erkennt der Client
den Systemproxy automatisch (PAC/WPAD/Windows-Gruppenrichtlinie), genau wie
ein normaler Browser. Details stehen in [`docs/desktop.md`](docs/desktop.md).

Alle Prüfungen:

```bash
npm run check
```

Die vollständige lokale CI-Prüfung einschließlich der
Docker-Compose-Konfiguration:

```bash
npm run verify
```

## Betriebszustand und Metriken

Die Container unterscheiden zwischen:

- `/health`: Prozess läuft
- `/ready`: benötigte interne Abhängigkeiten sind erreichbar
- `/metrics`: Prometheus-Textformat, geschützt durch `METRICS_TOKEN`

API- und Proxy-Logs werden als strukturierte JSON-Logs ausgegeben. Header,
Bodies, Ziel-URLs, Tokens und persönliche Variablen werden nicht als
strukturierte Logfelder erfasst.

Backups können vor einem Ernstfall nicht-destruktiv geprüft werden:

```bash
./scripts/verify-database-backup.sh /pfad/zum/backup.dump
```

Die produktive Wiederherstellung und ihre ausdrückliche
Datenverlust-Bestätigung sind in
[`docs/self-hosted-deployment.md`](docs/self-hosted-deployment.md)
beschrieben.

Bei Pushes auf `main` und in Pull Requests führt GitHub Actions dieselben
Prüfungen mit der in `.nvmrc` festgelegten Node.js-Version aus. Zusätzlich
werden Produktionsabhängigkeiten auf bekannte Schwachstellen hoher oder
kritischer Schwere geprüft.

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
./scripts/setup-selfhosted.sh
```

Das interaktive Setup fragt ab:

- öffentliche HTTPS-URL
- absolutes Verzeichnis für PostgreSQL und Backups
- Docker-Netzwerk des vorhandenen Nginx Proxy Managers

Es prüft Docker und Compose, erzeugt alle benötigten Secrets, legt die
Datenverzeichnisse mit restriktiven Rechten an, validiert die fertige
Compose-Konfiguration und gibt den vollständigen Startbefehl aus. Das Skript
startet selbst keine Container.

Für eine nicht-interaktive Vorbereitung:

```bash
./scripts/setup-selfhosted.sh \
  --url https://devapi.example.de \
  --data-dir /srv/devapi/data \
  --npm-network botnet \
  --non-interactive
```

Das Skript erzeugt `.env.selfhosted` mit zufälligem Datenbankpasswort,
JWT-Secret, öffentlichem Anwendungs-Key, internem Service-Role-Key (für die
selbstständige Kontolöschung, siehe AGENTS.md 7.4) und internem Proxy-Token.
Die Datei ist nicht für Git vorgesehen:

```bash
chmod 600 .env.selfhosted
```

Eine bestehende `.env.selfhosted` oder ein nicht leeres
PostgreSQL-Verzeichnis werden bewusst nicht überschrieben. Dadurch kann ein
versehentlicher zweiter Lauf keine produktiven Secrets oder Daten ersetzen.

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
3. nach serverseitiger Provider-Provisionierung optional OIDC-Anmeldung
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

Die Daten bleiben im während des Setups gewählten Hostverzeichnis erhalten.
Der normale Stop-Befehl entfernt sie nicht.

### 9. Backups und Offline-Betrieb

Der Betreiber ist selbst für Backups, Updates und Wiederherstellung
verantwortlich. Empfohlen werden:

- automatischer täglicher PostgreSQL-Dump durch den `db-backup`-Container
- 14 bis 30 Tage Aufbewahrung
- verschlüsselte Kopie außerhalb des App-Servers
- regelmäßiger Restore-Test
- Überwachung von HTTPS, Container-Healthchecks und freiem Speicher
- Log-Rotation mit begrenzter Aufbewahrung

Die Standardkonfiguration legt Dumps unter
`<DEVAPI_DATA_DIR>/backups` ab und bewahrt sie 30 Tage auf. Eine zusätzliche
verschlüsselte Kopie auf einem getrennten Datenträger bleibt erforderlich.

Im laufenden Betrieb baut DevAPI keine Verbindung zur Supabase-Plattform auf.
Für die erstmalige Installation müssen jedoch Images und Quellcode bezogen
werden. Für einen physisch vom Internet getrennten Betrieb müssen die
Container-Images und das Repository vorher in das Zielnetz übertragen werden.
Ein Let's-Encrypt-Zertifikat benötigt ebenfalls Internetzugang; vollständig
isolierte Netze verwenden stattdessen ein Zertifikat der eigenen CA.

Die ausführliche Betriebs-, Sicherheits- und Rollback-Anleitung steht in
[`docs/self-hosted-deployment.md`](docs/self-hosted-deployment.md).

Das sichere Electron-Grundgerüst und der geprüfte Windows-Build sind in
`docs/desktop.md` dokumentiert.

Die verbindlichen Produkt- und Entwicklungsregeln stehen in `AGENTS.md`.
