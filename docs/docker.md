# Docker und Deployment

## Struktur

Das Repository enthält mehrere kombinierbare Compose-Dateien:

- `compose.yaml` baut und startet Web, API und Request-Proxy.
- `compose.local.yaml` ergänzt PostgreSQL, Supabase Auth, PostgREST, einen
  lokalen API-Gateway, Mail-Capture, Auth-E-Mail-Vorlagen und den
  Migration-Runner.
- `compose.selfhosted.yaml` ergänzt PostgreSQL, Auth und PostgREST für den
  vollständig cloudfreien Serverbetrieb.
- `compose.npm-proxy.yaml` verbindet den Web-Container mit einem vorhandenen
  externen Nginx-Proxy-Manager-Netzwerk.

Die lokale Supabase-Ergänzung mit Mail-Capture ist für Entwicklung und
Integrationstests gedacht. Der reduzierte produktive Self-Hosted-Stack enthält
nur die von DevAPI benötigten Supabase-Komponenten. Details stehen unter
[self-hosted-deployment.md](self-hosted-deployment.md).

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

## OIDC

Die API liefert den optionalen Provider zur Laufzeit aus diesen Variablen:

```text
OIDC_PROVIDER=custom:company-oidc
OIDC_LABEL=Mit Firmenkonto anmelden
```

Der Provider selbst muss serverseitig in Supabase Auth konfiguriert werden.
Client-Secret, Issuer und andere vertrauliche Providerdaten gehören niemals in
Docker-Build-Args oder die öffentliche Laufzeitkonfiguration. Der reduzierte
Self-Hosted-Stack aktiviert standardmäßig nur Passwort-Authentifizierung; die
automatisierte Provisionierung eines Custom-OIDC-Providers ist noch nicht
Bestandteil des Setup-Skripts.

## Produktion

Der Standardablauf für die vollständig selbst gehostete
Einzelserver-Installation steht in
[self-hosted-deployment.md](self-hosted-deployment.md).

Vor einem öffentlichen Rollout:

1. Secrets mit `scripts/setup-selfhosted.sh` erzeugen und
   `.env.selfhosted` mit Dateimodus `0600` schützen.
2. TLS vor Web und Supabase erzwingen.
3. Nur Web beziehungsweise den vorgeschalteten Reverse Proxy veröffentlichen.
4. API, Request-Proxy, PostgreSQL und interne Supabase-Dienste in privaten
   Netzwerken halten.
5. Datenbank-Backups und eine Wiederherstellungsprobe einrichten.
6. Ressourcenlimits, Monitoring und Log-Rotation konfigurieren.
7. Image-Tags kontrolliert und gemeinsam aktualisieren.
8. Migrationen vor dem Rollout in einer Staging-Umgebung ausführen.

Self-hosted Supabase bringt zusätzliche Betriebsverantwortung für Updates,
Hochverfügbarkeit, Backups, Monitoring und Datenbankwartung mit. Die
Compose-Dateien dieses Repositories ersetzen diese Betriebsprozesse nicht.
