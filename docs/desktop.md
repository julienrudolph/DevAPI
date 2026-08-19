# Desktop-Anwendung

Die Desktop-Anwendung ist ein installierbarer Client für denselben zentralen
DevAPI-Server wie die Web-App. Teams, Workspaces, Berechtigungen, Revisionen
und Ausführungshistorie bleiben serverseitig.

## Architektur

Die vorhandene React-Anwendung wird lokal in das Electron-Paket eingebettet.
Sie lädt keine beliebige entfernte Webseite in einem privilegierten Fenster.

```text
React Renderer (Sandbox)
       |
       | app://devapi/api/*
       v
Electron Main Process
       |
       | ausschließlich konfigurierte HTTPS-Serveradresse
       v
DevAPI-Server
```

Der Main Process stellt nur diese Bridge bereit:

- aktuelle Serveradresse lesen
- validierte Serveradresse speichern
- verschlüsselte Supabase-Sitzung lesen, speichern und entfernen
- validierte Auth-URLs im Systembrowser öffnen
- `devapi://auth/callback` an den Renderer übergeben
- Betriebssystemplattform lesen

Dateisystem, Shell, Prozesse und allgemeine Netzwerkfunktionen werden nicht an
den Renderer weitergegeben.

## Sicherheitsvorgaben

- `nodeIntegration: false`
- `contextIsolation: true`
- Renderer-Sandbox aktiv
- lokales, als sicher registriertes `app://`-Protokoll
- keine neuen Browserfenster
- Navigation nur innerhalb `app://devapi`
- Serveradresse in installierten Builds ausschließlich über HTTPS
- keine Zugangsdaten in der Server-URL
- API-Weiterleitung nur an den konfigurierten Server-Origin
- Electron-Fuses deaktivieren `RunAsNode`, Node-Optionen und Inspect-Argumente
- ASAR-Integritätsprüfung und ausschließliches Laden aus ASAR
- Berechtigungsanfragen werden standardmäßig abgelehnt
- Supabase-Sitzungen werden mit Electron `safeStorage` verschlüsselt
- externe Auth-URLs müssen zum konfigurierten Server und dessen
  `/auth/v1/authorize`-Endpunkt gehören
- Deep Links akzeptieren ausschließlich `devapi://auth/callback`

HTTP zu `localhost` ist nur im nicht paketierten Entwicklungsbetrieb erlaubt.

## Entwicklung

Zuerst muss der lokale Serverstack laufen:

```bash
npm run compose:up
```

Desktop-App starten:

```bash
DEVAPI_SERVER_URL=http://localhost:8080 npm run dev:desktop
```

Ohne `DEVAPI_SERVER_URL` zeigt die Anwendung beim ersten Start die
Serverauswahl. Die Einstellung liegt im Electron-`userData`-Verzeichnis mit
restriktiven Dateirechten, soweit das Betriebssystem dies unterstützt.
Die Auth-Sitzung wird getrennt in `auth-session.bin` abgelegt und über den
Betriebssystem-Schlüsselspeicher verschlüsselt. Ist sichere Verschlüsselung
nicht verfügbar, wird keine Sitzung dauerhaft gespeichert.

## Build

Gemeinsame React-Ressourcen und Main/Preload-Prozess bauen:

```bash
npm run build:desktop
```

Ein lokales, unsigniertes Paket für das aktuelle Betriebssystem:

```bash
npm run package --workspace @api-client/desktop
```

Ein Windows-x64-Installer muss auf einem kontrollierten Windows-Runner gebaut
werden:

```bash
npm run make:windows
```

Jeder Pull Request und jeder Push auf `main` baut außerdem ein unsigniertes
Windows-x64-Paket. Dieser CI-Test prüft, dass Electron-Anwendung, `app.asar`
und Windows-Metadaten auch ohne Signing-Secrets reproduzierbar erzeugt werden.
Die geschützte Release-Pipeline bleibt zusätzlich für Installer,
Authenticode-Signatur und Installationstest verantwortlich.

### Windows-Installer Schritt für Schritt

Auf einem Windows-10- oder Windows-11-Rechner werden benötigt:

- Git
- die in `.nvmrc` festgelegte Node.js-Version, derzeit Node.js 22
- npm aus dieser Node.js-Installation

In PowerShell:

```powershell
git clone <REPOSITORY-URL> DevAPI
Set-Location DevAPI
npm ci
npm run verify
npm run make:windows
```

Der Build verwendet keine Supabase-Cloudressourcen und benötigt keine
Verbindung zur produktiven Datenbank. Er bündelt ausschließlich Web-Frontend
und Electron-Client. Die erzeugten Dateien liegen anschließend unter:

```text
apps/desktop/out/make/squirrel.windows/x64/Relay-Setup.exe
apps/desktop/out/make/zip/win32/x64/
```

Nach der Installation fragt Relay beim ersten Start nach der öffentlichen
HTTPS-Adresse des DevAPI-Servers, beispielsweise:

```text
https://devapi.example.de
```

Die Adresse enthält keinen zusätzlichen Pfad. Der Desktop-Client verwendet
danach dieselben Konten, Teams und Workspaces wie die Web-Anwendung.

Die Serveradresse lässt sich später jederzeit über die Kontoeinstellungen
(Zahnrad-Symbol) ändern, ohne die App neu zu installieren. Ein Wechsel meldet
den Nutzer ab und lädt die App neu, da eine Sitzung nur für den Server gültig
ist, der sie ausgestellt hat.

Passwort-Anmeldungen funktionieren vollständig innerhalb der App. OIDC wird
im Systembrowser geöffnet und mittels PKCE über `devapi://auth/callback` an
Relay zurückgegeben. Magic Links können denselben Callback verwenden, sofern
der Mailclient benutzerdefinierte Protokolle an Windows weiterleitet.

Der aktuelle Installer ist nicht digital signiert. Windows SmartScreen kann
deshalb eine Warnung anzeigen. Für interne Tests kann der Build verwendet
werden; vor einer allgemeinen Verteilung sind Code-Signing und ein Test auf
einer sauberen Windows-VM erforderlich.

### Signierter Release-Build

Der Workflow `.github/workflows/desktop-release.yml` läuft isoliert in der
geschützten GitHub-Umgebung `windows-signing`. Dort müssen diese Secrets
hinterlegt werden:

```text
WINDOWS_CERTIFICATE_BASE64
WINDOWS_CERTIFICATE_PASSWORD
```

`WINDOWS_CERTIFICATE_BASE64` enthält die Base64-kodierte PFX-Datei. Der
Workflow baut und signiert Anwendung sowie Installer, prüft beide
Authenticode-Signaturen, installiert Relay unbeaufsichtigt auf einem frischen
Windows-Runner und erzeugt `SHA256SUMS.txt`. Zertifikat und Passwort werden
nicht als Artefakt gespeichert. Die Umgebung sollte verpflichtende Freigaben
besitzen und nur für vertrauenswürdige Tags beziehungsweise manuelle Starts
verwendet werden.

Ein Release-Build kann manuell gestartet oder durch einen Tag ausgelöst
werden:

```text
desktop-v0.1.0
```

Der aktuelle Forge-Stack ist ausschließlich Build-Werkzeug. Der
Produktionsabhängigkeits-Audit enthält keine bekannten Schwachstellen. Vor
jedem Release müssen trotzdem der vollständige Buildwerkzeug-Audit und die
Herkunft aller Build-Eingaben geprüft werden. Unvertrauenswürdige Archive oder
Pull-Request-Artefakte dürfen nicht in einem signierenden Job verarbeitet
werden.

## Noch offen vor einer verteilbaren Windows-Version

- reales Code-Signing-Zertifikat in der geschützten CI-Umgebung hinterlegen
- Updatekanal erst nach funktionierender Signierung

Die lokale Ausführung von Requests gegen `localhost` oder private Netzwerke ist
noch nicht enthalten. In dieser ersten Desktop-Stufe werden Requests wie im
Browser über den zentralen, abgesicherten Server-Proxy ausgeführt.
