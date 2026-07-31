# Produktionsbetrieb

> Diese Datei beschreibt die optionale Variante mit einem externen
> Supabase-Projekt. Der cloudfreie Standardbetrieb ist unter
> [self-hosted-deployment.md](self-hosted-deployment.md) dokumentiert.

Diese Anleitung beschreibt die weiterhin unterstützte externe Variante:

- ein Linux-Server mit Docker Compose
- Caddy als einziger öffentlich erreichbarer Dienst
- Web, API und Request-Proxy im privaten Docker-Netz
- ein separates, produktiv konfiguriertes Supabase-Projekt

Der schlanke Supabase-Stack aus `compose.local.yaml` bleibt bewusst eine
Entwicklungsumgebung. Er verwendet unter anderem Mail-Capture und ersetzt keine
vollständige, gehärtete Supabase-Installation.

Wenn bereits Nginx Proxy Manager vorhanden ist, kann dieser Caddy vollständig
ersetzen. Dafür steht das Overlay `compose.npm-proxy.yaml` zur Verfügung. Die
Schritt-für-Schritt-Anleitung befindet sich in
[nginx-proxy-manager.md](nginx-proxy-manager.md).

## Voraussetzungen

- ein Server mit aktueller Docker Engine und Docker Compose
- mindestens 2 CPU-Kerne, 4 GB RAM und ausreichend freier Speicher
- eine Domain, beispielsweise `devapi.example.de`
- DNS-A- und gegebenenfalls AAAA-Record auf den Server
- eingehend freigegebene Ports `80/tcp`, `443/tcp` und optional `443/udp`
- ein produktives Supabase-Projekt mit angewendeten Migrationen
- ein Auth-Setup im Supabase-Projekt

API, Proxy und Datenbank dürfen nicht über die Server-Firewall veröffentlicht
werden.

## Konfiguration

Produktionsvorlage kopieren:

```bash
cp .env.production.example .env.production
```

Danach mindestens diese Werte ersetzen:

```text
PUBLIC_HOST=devapi.example.de
ACME_EMAIL=admin@example.de
SITE_URL=https://devapi.example.de
SUPABASE_PUBLIC_URL=https://PROJECT.supabase.co
SUPABASE_INTERNAL_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PROXY_INTERNAL_TOKEN=<mindestens 32 zufällige Zeichen>
```

`.env.production` enthält vertrauliche Werte, ist durch `.gitignore`
ausgeschlossen und darf nicht in Backups oder Tickets unverschlüsselt
weitergegeben werden.

Die öffentliche Clientkonfiguration wird beim Start der Anwendung über
`GET /api/v1/config` geladen. Sie enthält ausschließlich die öffentliche
Supabase-URL, den Publishable Key und optionale OIDC-Anzeigenamen. Der
Proxy-Token, Datenbankpasswörter und OIDC-Secrets werden dort niemals
ausgegeben.

## Supabase vorbereiten

Der dokumentierte Produktionsweg setzt ein Projekt auf der
Supabase-Plattform voraus. Dieses Projekt enthält bereits PostgreSQL, Auth und
die Daten-API; auf dem Anwendungsserver ist kein eigener Datenbankcontainer
erforderlich.

Die lokale Supabase-Erweiterung `compose.local.yaml` ist nur für Entwicklung
und Tests bestimmt. Ein vollständig selbst gehosteter Produktionsbetrieb
benötigt einen separaten gehärteten Supabase-Stack und ist nicht mit dem
nachfolgend beschriebenen Hosted-Supabase-Deployment gleichzusetzen.

Die folgenden Befehle im Wurzelordner des DevAPI-Repositories ausführen:

```bash
npx supabase init
npx supabase login
npx supabase link --project-ref <PROJECT_REFERENCE>
npx supabase db push --dry-run
npx supabase db push
```

`PROJECT_REFERENCE` steht in der URL des geöffneten Supabase-Projekts hinter
`/project/`. Auf einem Server ohne Browser kann
`npx supabase login --no-browser` verwendet werden. Die CLI sortiert die
Dateien aus `supabase/migrations` anhand ihres vorangestellten Zeitstempels und
wendet nur noch nicht registrierte Migrationen an.

Danach im Supabase Dashboard:

1. **Authentication → URL Configuration** öffnen.
2. `https://devapi.example.de` als **Site URL** konfigurieren.
3. `https://devapi.example.de/auth/confirm` unter **Redirect URLs** ergänzen.
4. Unter **Authentication → Sign In / Providers → Email** die
   Passwort-Anmeldung konfigurieren.
5. produktives SMTP aktivieren und Anmeldung sowie Einladung testen.
6. optional den Custom-OIDC-Provider serverseitig konfigurieren.
7. Row Level Security und Cross-Tenant-Negativtests gegen Staging ausführen.

Provider-Secrets gehören nur in Supabase beziehungsweise dessen Secret Store.

### Einfacher Testbetrieb ohne SMTP

Die Standardkonfiguration zeigt Passwort-Anmeldung und Selbstregistrierung und
blendet Magic Link aus:

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
```

Im Hosted-Supabase-Projekt muss dazu `Confirm Email` deaktiviert werden. Bei
einer selbst gehosteten GoTrue-Instanz entspricht dies:

```text
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_MAILER_AUTOCONFIRM=true
```

Ohne SMTP funktionieren Passwort-Reset, E-Mail-Verifikation, Magic Links,
Einladungsmails und Sicherheitsbenachrichtigungen nicht. Vergessene Passwörter
müssen administrativ zurückgesetzt werden.

Dieser Modus ist für einen internen Testserver gedacht. Für einen öffentlich
erreichbaren Produktivbetrieb müssen E-Mail-Bestätigung und SMTP eingerichtet
oder Selbstregistrierung deaktiviert und OIDC verwendet werden.

## Erstes Deployment

Konfiguration ohne Änderungen prüfen:

```bash
docker compose \
  --env-file .env.production \
  -f compose.yaml \
  -f compose.production.yaml \
  config --quiet
```

Start:

```bash
npm run compose:production:up
```

Caddy fordert für `PUBLIC_HOST` automatisch ein TLS-Zertifikat an. DNS muss
deshalb vor dem Start korrekt auf den Server zeigen.

Prüfungen:

```text
https://devapi.example.de/healthz
https://devapi.example.de/api/health
https://devapi.example.de/api/v1/config
```

Anschließend müssen mindestens Anmeldung, Workspace-Lesen, Speichern mit
Versionsprüfung, Request-Ausführung und ein Cross-Tenant-Negativfall getestet
werden.

## Netzwerk- und Sicherheitsgrenzen

`compose.yaml` veröffentlicht selbst keine Ports mehr. Im lokalen Overlay
werden Diagnoseports ausschließlich an `127.0.0.1` gebunden. Im
Produktions-Overlay veröffentlicht nur Caddy Ports.

Caddy setzt unter anderem:

- HSTS
- Content Security Policy
- `X-Content-Type-Options`
- `X-Frame-Options`
- restriktive Permissions Policy
- komprimierte Übertragung

Der Request-Proxy besitzt zusätzlich ein separates Egress-Netz. Er ist nur über
die API und den internen Proxy-Token erreichbar.

## Aktualisierung und Rollback

Vor jedem Update:

1. Supabase-Datenbank sichern.
2. Restore-Fähigkeit des letzten Backups kennen.
3. Release Notes und neue Migrationen prüfen.
4. Images in einer Staging-Installation bauen.
5. `npm run check` und die kritischen E2E-Pfade ausführen.

Danach:

```bash
git pull --ff-only
npm run compose:production:up
```

Migrationen sind vorwärtsgerichtet. Ein Code-Rollback ist nur sicher, wenn die
vorherige Version mit dem bereits migrierten Schema kompatibel ist. Andernfalls
ist ein dokumentierter Restore erforderlich.

## Backups

Bei Hosted Supabase müssen automatische Datenbankbackups entsprechend dem
gewählten Tarif aktiviert und regelmäßig exportiert werden. Zusätzlich gilt:

- tägliche Sicherung
- mindestens 14 bis 30 Tage Aufbewahrung
- verschlüsselte Kopie außerhalb des Anwendungsservers
- monatliche Wiederherstellungsprobe in eine getrennte Umgebung
- dokumentierte Verantwortlichkeit und Alarmierung

Das Caddy-Datenvolume enthält Zertifikatszustand, aber keine fachlichen
Workspace-Daten. Es kann gesichert werden, ersetzt jedoch kein
Datenbankbackup.

## Betrieb und Monitoring

Mindestens überwachen:

- HTTPS-Erreichbarkeit und Zertifikatsablauf
- Healthchecks von Web, API und Proxy
- HTTP-Fehlerraten
- CPU, RAM und freier Speicher
- fehlgeschlagene Auth- und E-Mail-Zustellung
- Datenbankkapazität und Backupstatus

Logs dürfen keine Authorization-, Cookie- oder API-Key-Header und keine
Request- oder Response-Bodies enthalten. Der Reverse-Proxy-Zugriffslog enthält
nur Metadaten und muss mit Rotation und begrenzter Aufbewahrung betrieben
werden.
