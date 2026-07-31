# Betrieb hinter Nginx Proxy Manager

Diese Variante ist für einen Server gedacht, auf dem Nginx Proxy Manager
bereits den eingehenden Verkehr, TLS-Zertifikate und die Weiterleitung zu
Docker-Diensten übernimmt. Der Standardweg verwendet den vollständig selbst
gehosteten Stack aus `compose.selfhosted.yaml`.

## Zielarchitektur

```text
Internet
  |
  v
Nginx Proxy Manager (Ports 80/443, TLS)
  |
  | externes Docker-Netz "botnet"
  v
DevAPI Web (Port 8080)
  |
  | privates Docker-Netz "backend"
  +--> DevAPI API
         |
         +--> abgesicherter Request-Proxy
```

Nur der Web-Container ist Mitglied beider Netzwerke. API und Request-Proxy
werden weder mit `botnet` verbunden noch über einen Host-Port veröffentlicht.
Der Browser erreicht die API über `/api`; der Web-Container leitet diese
Anfragen intern weiter.

## 1. Voraussetzungen prüfen

Das externe Netzwerk muss bereits existieren:

```bash
docker network inspect botnet
```

In der Ausgabe muss auch der Container von Nginx Proxy Manager als Mitglied
erscheinen. Falls er noch nicht verbunden ist, sollte dessen eigene
Compose-Konfiguration das bestehende Netzwerk deklarieren:

```yaml
services:
  app:
    networks:
      - botnet

networks:
  botnet:
    external: true
```

Der tatsächliche Servicename von Nginx Proxy Manager kann von `app`
abweichen. Das Netzwerk nicht neu anlegen, wenn es bereits existiert.

## 2. DevAPI konfigurieren

Im Wurzelordner des DevAPI-Repositories das interaktive Setup starten:

```bash
./scripts/setup-selfhosted.sh
```

Das Skript fragt URL, Datenverzeichnis und Netzwerk ab, erzeugt alle Secrets
und gibt am Ende den Startbefehl aus. Für die Proxy-Anbindung ist insbesondere
dieser Wert relevant:

```text
NPM_NETWORK=botnet
PUBLIC_HOST=devapi.example.de
SITE_URL=https://devapi.example.de
SUPABASE_PUBLIC_URL=https://devapi.example.de
```

`NPM_NETWORK` ist der Docker-Netzwerkname. `PUBLIC_HOST` enthält kein
Protokoll, `SITE_URL` dagegen schon.

## 3. Compose-Konfiguration prüfen und starten

```bash
npm run compose:selfhosted:config
npm run compose:selfhosted:up
```

Ohne npm sind die entsprechenden Befehle:

```bash
docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  config --quiet

docker compose \
  --env-file .env.selfhosted \
  -f compose.yaml \
  -f compose.selfhosted.yaml \
  -f compose.npm-proxy.yaml \
  up -d --build --wait
```

DevAPI veröffentlicht in dieser Variante keinen Host-Port.

## 4. Proxy Host in Nginx Proxy Manager

Unter **Hosts → Proxy Hosts → Add Proxy Host**:

| Einstellung | Wert |
|---|---|
| Domain Names | `devapi.example.de` |
| Scheme | `http` |
| Forward Hostname / IP | `devapi-web` |
| Forward Port | `8080` |
| Cache Assets | aus |
| Block Common Exploits | an |
| Websockets Support | an |

`devapi-web` ist ein stabiler Netzwerkalias aus dem Compose-Overlay. Die
automatisch erzeugten Containernamen wie `devapi-web-1` sollten nicht
eingetragen werden, da sie sich ändern können.

Unter **SSL**:

1. ein vorhandenes Zertifikat auswählen oder ein Let's-Encrypt-Zertifikat
   anfordern
2. `Force SSL` aktivieren
3. `HTTP/2 Support` aktivieren
4. HSTS erst nach erfolgreichem HTTPS-Test aktivieren

Für die erste Inbetriebnahme sind keine benutzerdefinierten Location-Regeln
nötig. Insbesondere `/api`, `/auth/v1` und `/rest/v1` dürfen nicht direkt auf
interne Container zeigen, weil die vorgesehene interne Weiterleitung und
Sicherheitsgrenze sonst umgangen würde.

## 5. DNS, Auth und Firewall

- Der DNS-Eintrag der Domain zeigt auf den Nginx-Proxy-Manager-Server.
- Site URL und erlaubte Auth-Weiterleitungen stehen in `.env.selfhosted`.
- Eine Supabase-Cloudoberfläche wird nicht benötigt.
- Von außen sind nur die durch Nginx Proxy Manager benötigten Ports 80 und
  443 geöffnet.
- Die Ports 8080, 3001 und 3002 werden nicht in der Server-Firewall
  freigegeben und nicht in Compose veröffentlicht.

## 6. Funktion prüfen

Nach dem Speichern des Proxy Hosts:

```text
https://devapi.example.de/healthz
https://devapi.example.de/api/health
https://devapi.example.de/api/v1/config
```

Danach Registrierung, Anmeldung, Workspace-Zugriff und Request-Ausführung
testen. Der öffentliche Konfigurationsendpunkt darf keine internen Tokens oder
Secrets ausgeben.

Der Web-Container muss über den Alias erreichbar sein. Falls Nginx Proxy
Manager `502 Bad Gateway` meldet:

1. prüfen, ob beide Container Mitglieder von `botnet` sind
2. prüfen, ob als Ziel exakt `devapi-web:8080` verwendet wird
3. den Zustand mit `docker compose ... ps` und die Logs beider Anwendungen
   prüfen

## 7. Updates und Stoppen

Update:

```bash
git pull --ff-only
npm run compose:selfhosted:config
npm run compose:selfhosted:up
```

Stoppen:

```bash
npm run compose:selfhosted:down
```

Das externe Netzwerk `botnet` und der Nginx Proxy Manager werden durch diesen
Befehl nicht entfernt. Die DevAPI-Daten im konfigurierten Hostverzeichnis
bleiben erhalten.
