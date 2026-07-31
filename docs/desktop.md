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

Der aktuelle Installer ist nicht digital signiert. Windows SmartScreen kann
deshalb eine Warnung anzeigen. Für interne Tests kann der Build verwendet
werden; vor einer allgemeinen Verteilung sind Code-Signing und ein Test auf
einer sauberen Windows-VM erforderlich.

Der aktuelle Forge-Stack ist ausschließlich Build-Werkzeug. Der
Produktionsabhängigkeits-Audit enthält keine bekannten Schwachstellen. Vor
jedem Release müssen trotzdem der vollständige Buildwerkzeug-Audit und die
Herkunft aller Build-Eingaben geprüft werden. Unvertrauenswürdige Archive oder
Pull-Request-Artefakte dürfen nicht in einem signierenden Job verarbeitet
werden.

## Noch offen vor einer verteilbaren Windows-Version

- Deep-Link `devapi://auth/callback`
- PKCE-/OIDC-Callback über den Systembrowser
- Magic-Link-Weiterleitung über den öffentlichen Web-Callback
- verschlüsselte Sessionablage
- Windows-Icon und Anwendungsmetadaten
- Code-Signing-Zertifikat und isolierter Signing-Job
- Installer-Test auf sauberer Windows-VM
- Releaseartefakte und SHA-256-Prüfsummen
- Updatekanal erst nach funktionierender Signierung

Die lokale Ausführung von Requests gegen `localhost` oder private Netzwerke ist
noch nicht enthalten. In dieser ersten Desktop-Stufe werden Requests wie im
Browser über den zentralen, abgesicherten Server-Proxy ausgeführt.
