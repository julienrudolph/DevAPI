# Docker und Deployment

## Struktur

Das Repository enthält zwei kombinierbare Compose-Dateien:

- `compose.yaml` baut und startet Web, API und Request-Proxy.
- `compose.local.yaml` ergänzt PostgreSQL, Supabase Auth, PostgREST, einen
  lokalen API-Gateway, Mail-Capture, Auth-E-Mail-Vorlagen und den
  Migration-Runner.
- `compose.production.yaml` ergänzt Caddy mit automatischem TLS und
  veröffentlicht ausschließlich die HTTP-/HTTPS-Eingänge.

Die lokale Supabase-Ergänzung ist für Entwicklung und Integrationstests
gedacht. Für ein öffentliches Self-Hosting soll die vollständige, von Supabase
veröffentlichte Docker-Distribution verwendet werden. Sie ergänzt unter
anderem Secret-Generierung, Studio, Pooling, Backups und weitere
Betriebsfunktionen.

## Lokalen Stack starten

Voraussetzungen:

- Docker Engine beziehungsweise Docker Desktop
- Docker Compose
- mindestens 4 GB freier Arbeitsspeicher

Einmalig lokale Secrets erzeugen:

```bash
npm run compose:env
```

Danach den Stack bauen und starten:

```bash
npm run compose:up
```

Erreichbare Dienste:

| Dienst | Adresse |
|---|---|
| Web-App | `http://localhost:8080` |
| API | `http://localhost:3001/health` |
| Request-Proxy | `http://localhost:3002/health` |
| Supabase Auth und REST | `http://localhost:8000` |
| Mail-Capture | `http://localhost:9000` |
| PostgreSQL | `localhost:54322` |

Standardmäßig verwendet der lokale Stack Passwort-Anmeldung,
Selbstregistrierung und automatische Bestätigung. Dadurch ist für den Einstieg
keine Mail erforderlich. Wenn `MAGIC_LINK_AUTH_ENABLED=true` und
`AUTH_AUTOCONFIRM=false` gesetzt werden, erscheinen Anmeldelinks im
Mail-Capture. Die Links verwenden die lokalen Vorlagen und führen über
`/auth/confirm` zurück zur Web-App.

Stack stoppen:

```bash
npm run compose:down
```

Die PostgreSQL-Daten bleiben im benannten Docker-Volume erhalten. Das Löschen
dieses Volumes entfernt alle lokalen Daten und ist daher kein normaler
Stop-Vorgang.

## Migrationen

Der kurzlebige Dienst `migrate` wartet auf PostgreSQL und Supabase Auth und
wendet anschließend alle Dateien aus `supabase/migrations` in sortierter
Reihenfolge an. Bereits erfolgreich angewendete Dateinamen werden in
`app_migrations.applied` erfasst.

Vor Auth und PostgREST initialisiert der kurzlebige Dienst `db-bootstrap` die
lokalen Datenbankrollen mit dem generierten Datenbankpasswort. Er ist
idempotent und funktioniert sowohl bei einer neuen als auch bei einer bereits
vorhandenen lokalen Datenbank.

Eine Migration darf nach ihrer Anwendung nicht verändert werden. Korrekturen
erfolgen durch eine neue, später sortierte Migrationsdatei.

## Hosted Supabase verwenden

Für Entwicklung oder Deployment mit Hosted Supabase wird nur `compose.yaml`
benötigt. In `.env.compose` werden gesetzt:

```text
SUPABASE_PUBLIC_URL=https://PROJECT.supabase.co
SUPABASE_INTERNAL_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Start:

```bash
docker compose --env-file .env.compose -f compose.yaml up -d --build --wait
```

Die Datenbankmigrationen werden in diesem Fall über die Supabase-CLI oder die
Deployment-Pipeline angewendet, nicht durch `compose.local.yaml`.

Die Supabase-E-Mail-Vorlagen für Registrierung und Magic Link müssen außerdem
wie in `docs/authentication.md` beschrieben auf den Callback der Anwendung
zeigen.

## OIDC

Die API liefert den optionalen Provider zur Laufzeit aus diesen Variablen:

```text
OIDC_PROVIDER=custom:company-oidc
OIDC_LABEL=Mit Firmenkonto anmelden
```

Der Provider selbst wird in Supabase Auth konfiguriert. Client-Secret, Issuer
und andere vertrauliche Providerdaten gehören niemals in Docker-Build-Args oder
die öffentliche Laufzeitkonfiguration.

Für lokale Tests mit einem externen OIDC-System ist Hosted Supabase oder die
vollständige offizielle Self-hosted-Distribution der bevorzugte Weg. Der
schlanke lokale Stack aktiviert standardmäßig Passwort-Authentifizierung.

## Produktion

Der konkrete Ablauf für eine Einzelserver-Installation mit Hosted Supabase
steht in [production-deployment.md](production-deployment.md).

Vor einem öffentlichen Rollout:

1. Zufällige Produktions-Secrets in einem Secret-Manager erzeugen.
2. TLS vor Web und Supabase erzwingen.
3. Nur Web beziehungsweise den vorgeschalteten Reverse Proxy veröffentlichen.
4. API, Request-Proxy, PostgreSQL und interne Supabase-Dienste in privaten
   Netzwerken halten.
5. `WEB_BIND_ADDRESS` nur hinter einem abgesicherten Reverse Proxy auf
   `0.0.0.0` setzen.
6. Datenbank-Backups und eine Wiederherstellungsprobe einrichten.
7. Ressourcenlimits, Monitoring und Log-Rotation konfigurieren.
8. Image-Tags kontrolliert und gemeinsam aktualisieren.
9. Migrationen vor dem Rollout in einer Staging-Umgebung ausführen.

Self-hosted Supabase bringt zusätzliche Betriebsverantwortung für Updates,
Hochverfügbarkeit, Backups, Monitoring und Datenbankwartung mit. Die
Compose-Dateien dieses Repositories ersetzen diese Betriebsprozesse nicht.
