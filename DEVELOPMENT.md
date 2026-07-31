# DevAPI weiterentwickeln

Diese Anleitung richtet sich an Entwickler, die das Repository zum ersten Mal
öffnen. Sie beschreibt den lokalen Start, die Architektur, typische
Änderungsabläufe und die Prüfungen vor einem Commit.

Die verbindlichen Produkt-, Architektur- und Sicherheitsregeln stehen in
[AGENTS.md](AGENTS.md). Bei Widersprüchen hat `AGENTS.md` Vorrang.

## 1. Voraussetzungen

- Node.js gemäß `.nvmrc` beziehungsweise mindestens Version 22
- npm
- Docker Engine oder Docker Desktop mit Docker Compose
- Git
- mindestens 4 GB freier Arbeitsspeicher für den lokalen Gesamtstack

Installation prüfen:

```bash
node --version
npm --version
docker version
docker compose version
```

## 2. Repository aufsetzen

```bash
git clone <REPOSITORY-URL> DevAPI
cd DevAPI
npm ci
```

`npm ci` verwendet den eingecheckten Lockfile und verändert ihn nicht. Neue
Abhängigkeiten werden dagegen gezielt mit `npm install` hinzugefügt und müssen
einen nachvollziehbaren Nutzen haben.

## 3. Schnellster lokaler Start

Einmalig lokale Secrets erzeugen:

```bash
npm run compose:env
```

Danach den vollständigen Entwicklungsstack starten:

```bash
npm run compose:up
```

Erreichbare Dienste:

| Dienst | Adresse |
|---|---|
| Web-App | `http://localhost:8080` |
| DevAPI-API | `http://localhost:3001/health` |
| Request-Proxy | `http://localhost:3002/health` |
| Auth und PostgREST | `http://localhost:8000` |
| Test-Postfach | `http://localhost:9000` |
| PostgreSQL | `localhost:54322` |

Die lokale Standardkonfiguration erlaubt Registrierung und Anmeldung per
E-Mail und Passwort ohne E-Mail-Bestätigung.

Stack stoppen:

```bash
npm run compose:down
```

Der normale Stop-Befehl erhält das lokale Datenvolume. Keine Compose-Befehle
mit `-v` verwenden, wenn die lokalen Daten noch benötigt werden.

## 4. Schnelle Entwicklung mit Hot Reload

Der vollständige Docker-Stack ist der zuverlässigste Integrationsweg.
Einzelne Anwendungsteile können für kürzere Feedbackzyklen lokal ersetzt
werden.

### Weboberfläche

Zuerst den Gesamtstack starten und anschließend nur den Web-Container stoppen:

```bash
npm run compose:up
docker compose \
  --env-file .env.compose \
  -f compose.yaml \
  -f compose.local.yaml \
  stop web
npm run dev:web
```

Die Vite-Anwendung ist dann unter `http://localhost:5173` erreichbar. `/api`
wird an die weiterhin in Docker laufende API auf Port 3001 weitergeleitet.

### Request-Proxy

Der API-Container erreicht einen auf dem Host gestarteten Proxy nicht über
seinen Docker-Servicenamen. Für Proxy-Hot-Reload daher API und Proxy gemeinsam
lokal starten. Nach dem Start des Gesamtstacks beide Container stoppen:

```bash
docker compose \
  --env-file .env.compose \
  -f compose.yaml \
  -f compose.local.yaml \
  stop api proxy
```

Erstes Terminal:

```bash
NODE_OPTIONS=--env-file=.env.compose npm run dev:proxy
```

Zweites Terminal:

```bash
SUPABASE_URL=http://127.0.0.1:8000 \
PUBLIC_SUPABASE_URL=http://127.0.0.1:8000 \
PROXY_INTERNAL_URL=http://127.0.0.1:3002 \
NODE_OPTIONS=--env-file=.env.compose \
npm run dev:api
```

### Nur API

Soll nur die API lokal laufen, bleibt der Proxy-Container aktiv. Lediglich
`api` stoppen und anschließend denselben API-Befehl aus dem vorherigen
Abschnitt verwenden.

Nach einem Wechsel zurück zum vollständigen Dockerbetrieb genügt erneut:

```bash
npm run compose:up
```

## 5. Architektur

```text
apps/web
  React-SPA, Formulare, Editor, lokale Entwürfe
      |
      | /api
      v
apps/api
  Authentifizierung, Rollen, Geschäftslogik, Konflikte
      |
      +--> PostgREST/PostgreSQL mit Benutzer-JWT und RLS
      |
      +--> apps/proxy über internen Service-Token

packages/contracts
  gemeinsame Zod-Schemas und TypeScript-Verträge

supabase/migrations
  Schema, RLS-Policies und atomare Datenbankfunktionen

apps/desktop
  sicherer Electron-Wrapper für denselben DevAPI-Server
```

### Web

- TanStack Query verwaltet Server-State.
- React Hook Form und lokaler Komponenten-State halten Entwürfe.
- Zustand ist nur für übergreifenden lokalen UI-State vorgesehen.
- Serverdaten dürfen nicht dauerhaft in Zustand gespiegelt werden.
- Ungespeicherte Entwürfe dürfen durch Refetches nicht verloren gehen.

### API

- Fastify stellt die fachlichen HTTP-Endpunkte bereit.
- Eingaben werden an der Grenze mit Schemas aus `packages/contracts`
  validiert.
- Die API übernimmt keine Nutzer-, Rollen- oder Team-ID ungeprüft vom Client.
- Datenzugriffe verwenden die Sitzung des angemeldeten Nutzers, damit RLS
  greift.

### Request-Proxy

Der Proxy ist eine eigene Sicherheitsgrenze. Änderungen an URL-Prüfung, DNS,
Redirects, Headern, Timeouts oder Größenlimits benötigen immer negative
Sicherheitstests. Private, lokale und reservierte Ziele bleiben blockiert.

### Datenbank

RLS ist Teil der Autorisierung und keine optionale zweite Schutzschicht.
Rollenprüfungen, optimistisches Locking, Revisionen und mandantenbezogene
Zugriffe werden auch in PostgreSQL erzwungen.

## 6. Wo gehört eine Änderung hin?

| Änderung | Bevorzugter Ort |
|---|---|
| API-Vertrag oder Validierung | `packages/contracts/src` |
| React-Oberfläche | `apps/web/src/features/<feature>` |
| Wiederverwendbares UI-Primitiv | `apps/web/src/components` |
| Fachlicher API-Endpunkt | `apps/api/src/app.ts` und Domain-Port |
| Supabase-Datenzugriff | `apps/api/src/infrastructure` |
| SSRF- oder Header-Schutz | `apps/proxy/src/security` |
| HTTP-Ausführung | `apps/proxy/src/execution` |
| Schema, RLS oder Datenbankfunktion | neue Datei in `supabase/migrations` |
| Desktop-Bridge | `apps/desktop/src` |
| Deployment | Compose-Dateien, `infra/` und `docs/` |

Frontend und Backend teilen nur Verträge, keine internen Implementierungen.

## 7. Datenbankmigrationen

Migrationen liegen unter `supabase/migrations` und beginnen mit einem
UTC-Zeitstempel:

```text
YYYYMMDDHHMMSS_beschreibung.sql
```

Beispiel:

```text
20260801120000_add_collection_description.sql
```

Regeln:

- Eine bereits angewendete Migration niemals nachträglich verändern.
- Korrekturen erfolgen als neue Migration.
- Tabellenänderungen enthalten passende Constraints und RLS-Policies.
- Schreibfunktionen prüfen Mitgliedschaft und Rolle serverseitig.
- Migrationen müssen mit einer neuen lokalen Datenbank und mit einem bereits
  migrierten Datenbestand funktionieren.

Der lokale `migrate`-Container führt fehlende Dateien beim
`npm run compose:up` automatisch in Dateinamenreihenfolge aus.

## 8. Tests und Qualitätsprüfungen

Alle Prüfungen:

```bash
npm run check
```

Das umfasst TypeScript, alle Tests und Produktions-Builds.

Zusätzlich die lokale Compose-Konfiguration prüfen:

```bash
npm run verify
```

Gezielte Tests:

```bash
npm test --workspace @api-client/web
npm test --workspace @api-client/api
npm test --workspace @api-client/proxy
npm test --workspace @api-client/contracts
```

Für eine einzelne Vitest-Datei:

```bash
npm test --workspace @api-client/web -- \
  src/features/requests/request-editor.test.tsx
```

Neue Logik benötigt Tests auf der passenden Ebene:

- Schema und pure Fachlogik: Unit-Test
- React-Verhalten und Dirty-State: Komponententest
- API und Repository-Zusammenspiel: Integrationstest
- RLS und Mandantentrennung: Datenbank-Negativtest
- Proxy-Schutz: Sicherheits- und Umgehungstest

## 9. Typischer Änderungsablauf

1. Betroffene Verträge und Sicherheitsgrenzen identifizieren.
2. Akzeptanzkriterien einschließlich Fehler- und Negativfällen festlegen.
3. Vertrag beziehungsweise Migration zuerst anpassen.
4. Backend- und Frontendänderung klein und zusammenhängend umsetzen.
5. Relevante Tests ergänzen.
6. `npm run check` und die passende Compose-Prüfung ausführen.
7. Dokumentation aktualisieren.
8. Diff auf Secrets, Testdaten und unbeabsichtigte Dateien prüfen.

## 10. Konflikte und lokale Entwürfe

Gemeinsam bearbeitete Ressourcen verwenden eine monoton steigende
`version`. Schreibvorgänge senden `expectedVersion`. Bei Abweichung antwortet
die API mit HTTP 409.

Bei Änderungen an diesem Ablauf müssen folgende Garantien erhalten bleiben:

- kein stilles Überschreiben
- lokaler Entwurf bleibt bei 409 erhalten
- Server- und lokale Version können verglichen werden
- Überschreiben benötigt eine bewusste Bestätigung
- vorherige Fassung wird atomar als Revision gespeichert

## 11. Secrets und Testdaten

Nicht committen:

- `.env.compose`
- `.env.selfhosted`
- Datenbankdumps
- echte Tokens, API-Keys oder Passwörter
- reale Kundendaten

Beispielkonfigurationen enthalten ausschließlich erkennbare Platzhalter.
Authorization-, Cookie- und API-Key-Header dürfen nicht geloggt werden.

## 12. Desktop-Entwicklung

Mit laufendem lokalen Serverstack:

```bash
DEVAPI_SERVER_URL=http://localhost:8080 npm run dev:desktop
```

Weitere Sicherheits- und Buildhinweise stehen in
[docs/desktop.md](docs/desktop.md).

## 13. Vor einem Pull Request oder Commit

- Arbeitsbaum auf unbeabsichtigte Änderungen prüfen.
- `npm run verify` erfolgreich ausführen.
- Neue Migrationen und RLS-Policies prüfen.
- Auth-, Proxy- und Mandantenänderungen negativ testen.
- README beziehungsweise Fachdokumentation aktualisieren.
- Keine Secrets oder generierten Produktionsdaten einchecken.

Die vollständige Definition of Done steht in [AGENTS.md](AGENTS.md).
