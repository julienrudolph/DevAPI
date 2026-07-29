# Collaborative API Client

Ein schlanker, kollaborativer REST-API-Client für gemeinsame Team-Workspaces.

## Projektstatus

Das Projekt befindet sich im Aufbau. Der erste Meilenstein stellt das technische
Fundament bereit: React/Vite-Weboberfläche, getrennte API- und Proxy-Dienste sowie
gemeinsame, validierte Verträge.

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

Der Proxy benötigt für Ausführungsaufrufe einen internen Service-Token:

```bash
PROXY_INTERNAL_TOKEN="lokaler-nur-für-die-entwicklung-token" npm run dev:proxy
```

Der Browser soll diesen Token später nicht erhalten. Die fachliche API prüft den
Supabase-Nutzer und ruft den isolierten Proxy anschließend serverseitig auf.

Alle Prüfungen:

```bash
npm run check
```

Die verbindlichen Produkt- und Entwicklungsregeln stehen in `AGENTS.md`.
