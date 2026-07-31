# Vollständig selbst gehostetes Deployment

Diese Anleitung beschreibt den cloudfreien Standardbetrieb von DevAPI hinter
einem vorhandenen Nginx Proxy Manager.

## Enthaltene Dienste

Der Compose-Stack startet:

- PostgreSQL mit Supabase-Rollen und Auth-Schema
- GoTrue als Supabase-Auth-Dienst
- PostgREST als RLS-fähige Daten-API
- einen internen Supabase-Gateway
- die DevAPI-Webanwendung
- die DevAPI-API
- den abgesicherten HTTP-Request-Proxy
- einmalige Bootstrap- und Migrationscontainer

Storage, Realtime, Studio, Analytics und Edge Functions sind nicht enthalten,
weil DevAPI sie derzeit nicht benötigt. Alle fachlichen Daten und
Anmeldekonten verbleiben im gewählten PostgreSQL-Datenverzeichnis auf dem
eigenen Server.

## Netzwerkgrenzen

```text
Internet
  |
Nginx Proxy Manager (TLS)
  |
botnet
  |
devapi-web:8080
  |
devapi_backend
  +-- api
  +-- proxy
  +-- supabase-gateway
  +-- auth
  +-- rest
  +-- db
```

Nur `devapi-web` ist Mitglied von `botnet`. Der Browser verwendet dieselbe
öffentliche Origin für App, Auth und Datenzugriff:

```text
https://devapi.example.de/             Webanwendung
https://devapi.example.de/api/         DevAPI-Backend
https://devapi.example.de/auth/v1/     Auth
https://devapi.example.de/rest/v1/     PostgREST
```

PostgreSQL sowie die internen Dienste veröffentlichen keine Ports am Host.

## Installation

Im Wurzelordner des geklonten Repositories:

```bash
./scripts/setup-selfhosted.sh
```

Das Skript fragt die öffentliche HTTPS-URL, das persistente Datenverzeichnis
und das externe NPM-Netzwerk ab. Anschließend prüft es die Voraussetzungen,
erzeugt zufällige Secrets, legt PostgreSQL- und Backup-Verzeichnisse an und
validiert Compose. Es startet den Stack nicht selbst, sondern gibt den
passenden Startbefehl aus.

Automatisierter Aufruf:

```bash
./scripts/setup-selfhosted.sh \
  --url https://devapi.example.de \
  --data-dir /srv/devapi/data \
  --npm-network botnet \
  --non-interactive
```

Der Installer schreibt die Secrets mit Dateimodus `0600` in
`.env.selfhosted`. Er verweigert das Überschreiben einer bestehenden
Konfiguration und eines nicht leeren PostgreSQL-Verzeichnisses.

## Nginx Proxy Manager

Einen Proxy Host konfigurieren:

| Einstellung | Wert |
|---|---|
| Domain | `devapi.example.de` |
| Scheme | `http` |
| Forward Hostname | `devapi-web` |
| Forward Port | `8080` |
| Block Common Exploits | an |
| Websockets Support | an |
| Force SSL | an |
| HTTP/2 Support | an |

Keine eigenen Locations für `/api`, `/auth/v1` oder `/rest/v1` anlegen. Die
Webanwendung leitet diese Pfade kontrolliert über das interne Netz weiter.

## Auth ohne Mailserver

Die erzeugte Standardkonfiguration erlaubt E-Mail-/Passwort-Registrierung und
bestätigt Konten automatisch:

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
AUTH_DISABLE_SIGNUP=false
AUTH_AUTOCONFIRM=true
```

Das ist der niedrigschwellige Einstieg ohne Mailserver. Die E-Mail-Adresse
wird dabei nicht verifiziert. Passwort-Wiederherstellung, Magic Links,
Einladungsmails und Sicherheitsbenachrichtigungen funktionieren erst nach
Konfiguration eines SMTP-Servers.

Auth-Einstellungen werden beim Self-Hosting über Umgebungsvariablen
konfiguriert. Eine Supabase-Cloudoberfläche wird nicht verwendet.

## Migrationen

Beim Start wartet der einmalige `migrate`-Container auf die Datenbank und
wendet Dateien aus `supabase/migrations` nach ihrem Zeitstempel an. Bereits
registrierte Migrationen werden übersprungen. Es sind keine Supabase CLI und
kein manuell installierter PostgreSQL-Client erforderlich.

Status und Logs:

```bash
docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  ps

docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  logs --tail=200
```

## Datensicherung

PostgreSQL liegt als Bind-Mount unter
`<DEVAPI_DATA_DIR>/postgres`. Der Dienst `db-backup` erstellt standardmäßig
alle 24 Stunden einen konsistenten Custom-Format-Dump unter
`<DEVAPI_DATA_DIR>/backups` und entfernt Dumps nach 30 Tagen.

Die Request-Ausführung besitzt standardmäßig Limits pro Nutzer, Workspace und
Proxy. Sie können in `.env.selfhosted` über
`EXECUTION_RATE_WINDOW_MS`, `EXECUTION_RATE_PER_USER`,
`EXECUTION_RATE_PER_WORKSPACE`, `EXECUTION_CONCURRENCY_PER_USER`,
`EXECUTION_CONCURRENCY_PER_WORKSPACE` und
`PROXY_MAX_CONCURRENT_REQUESTS` angepasst werden. Erhöhungen sollten erst nach
Beobachtung von CPU, Arbeitsspeicher, Netzwerk und Antwortgrößen erfolgen.

Die Intervalle stehen in `.env.selfhosted`:

```text
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30
```

Ein lokaler Dump auf demselben Server schützt nicht gegen Ausfall oder Verlust
des Servers. Mindestens eine verschlüsselte Kopie muss regelmäßig auf einen
getrennten Datenträger übertragen werden.

Zusätzlicher manueller Dump:

```bash
docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  exec -T db pg_dump -U supabase_admin -d postgres -Fc \
  > devapi-$(date +%F).dump
```

Backup-Dateien enthalten Anmelde- und Workspace-Daten und müssen
verschlüsselt, zugriffsgeschützt und regelmäßig durch eine Wiederherstellung
in einer getrennten Testumgebung geprüft werden.

### Wiederherstellungsprobe

Die Probe legt im bestehenden PostgreSQL-Cluster eine temporäre, getrennte
Datenbank an, restauriert den Dump, prüft zentrale Auth- und
Workspace-Tabellen und entfernt die Testdatenbank anschließend wieder:

```bash
./scripts/verify-database-backup.sh \
  /absoluter/pfad/zu/devapi-20260731T120000Z.dump
```

Sie verändert die produktive Datenbank nicht. Eine erfolgreiche Probe zeigt
zusätzlich die wiederhergestellten Anzahlen von Nutzern, Teams, Workspaces,
Requests und Revisionen.

### Produktive Wiederherstellung

Eine echte Wiederherstellung ersetzt den aktuellen Datenbankinhalt. Das
Skript prüft den Dump zuerst, erstellt ein Notfall-Backup des aktuellen
Zustands, stoppt abhängige Dienste und verlangt eine ausdrückliche
Bestätigung:

```bash
./scripts/restore-selfhosted-backup.sh \
  /absoluter/pfad/zu/devapi-20260731T120000Z.dump \
  --confirm-data-loss
```

Schlägt das Einspielen fehl, wird automatisch das unmittelbar zuvor erzeugte
Notfall-Backup restauriert. Nach Abschluss wartet das Skript auf die
Readiness-Checks aller Dienste.

## Betriebszustand und geschützte Metriken

`/api/health` ist ein Liveness-Endpunkt. `/api/ready` prüft zusätzlich, ob
Auth/PostgREST und der Request-Proxy erreichbar sind. Die Docker-Healthchecks
verwenden den Readiness-Endpunkt.

API und Proxy liefern Prometheus-Metriken nur mit `METRICS_TOKEN`. Die
Metriken verwenden feste Routenmuster und enthalten keine Nutzer-IDs,
Ziel-URLs, Header oder Bodies:

Bei einer bestehenden Installation kann `METRICS_TOKEN` als neues zufälliges
Secret in `.env.selfhosted` ergänzt werden. Fehlt es während eines Upgrades,
wird vorübergehend `PROXY_INTERNAL_TOKEN` verwendet, damit die Dienste nicht
ausfallen. Neue Installationen erzeugen immer ein separates Secret.

```bash
docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  exec -T api node -e \
  "fetch('http://127.0.0.1:3001/metrics',{headers:{authorization:'Bearer '+process.env.METRICS_TOKEN}}).then(r=>r.text()).then(console.log)"
```

## Kontrollierte Updates und Rollback

Deployments erfolgen auf einen expliziten Git-Tag oder Commit. Das Skript
verweigert einen unsauberen Arbeitsstand, verhindert parallele Deployments,
erstellt vorab einen PostgreSQL-Dump und wartet auf die Readiness-Checks:

```bash
./scripts/deploy-selfhosted-version.sh <Git-Tag-oder-Commit>
```

Bei einem Fehler stellt es den vorherigen Anwendungsstand wieder her.
Datenbankmigrationen werden bewusst nicht rückwärts ausgeführt. Das
Pre-Deployment-Backup bleibt erhalten.

Ein bewusstes Rollback verwendet dasselbe Skript mit dem vorherigen Commit.
Vorher muss bestätigt sein, dass die ältere Anwendung mit dem bereits
migrierten Schema kompatibel ist. Eine Datenbankwiederherstellung ist ein
separater, potenziell datenverlierender Vorgang.

Die Image-Tags sind festgeschrieben. Einzelne Supabase-Komponenten dürfen
nicht unabhängig und ungeprüft auf `latest` gesetzt werden.

## Offline-Abgrenzung

Der laufende Stack benötigt keine Supabase-Cloudressourcen und sendet keine
Supabase-Telemetrie. Für die Erstinstallation werden normalerweise Git,
Docker-Registry und npm benötigt. In einem vollständig isolierten Netz müssen
Repository, Container-Images und gegebenenfalls npm-Abhängigkeiten vorher
übertragen werden.

Auch öffentliche DNS-Auflösung und Let's Encrypt sind externe Dienste. Für
ein vollständig internes Netz können interner DNS und ein Zertifikat der
eigenen Zertifizierungsstelle verwendet werden.
