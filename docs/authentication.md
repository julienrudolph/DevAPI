# Authentifizierung

## Unterstützte Verfahren

Die Anwendung verwendet Supabase Auth als gemeinsame Sitzungs- und
Identitätsgrenze. Vorgesehen sind:

- E-Mail-Anmeldelink
- optional ein benutzerdefinierter OpenID-Connect-Provider

OIDC ist keine parallele lokale Benutzerverwaltung. Supabase Auth führt den
Authorization-Code-Flow aus und stellt anschließend eine normale
Supabase-Session aus. Dadurch bleiben `auth.uid()`, PostgreSQL-RLS und die
Workspace-Rollen für beide Anmeldewege identisch.

## OIDC-Provider konfigurieren

1. In Supabase unter **Auth → Providers** einen neuen Provider anlegen.
2. **Auto-discovery (OIDC)** auswählen.
3. Einen Bezeichner mit `custom:`-Präfix vergeben.
4. Client-ID, Client-Secret und Issuer-URL hinterlegen.
5. Die von Supabase angezeigte Callback-URL beim Identity Provider erlauben.
6. PKCE und Nonce-Prüfung aktiviert lassen.
7. Den Bezeichner im Web-Frontend konfigurieren:

```text
VITE_OIDC_PROVIDER=custom:company-oidc
VITE_OIDC_LABEL=Mit Firmenkonto anmelden
```

Der Client-Secret des OIDC-Providers gehört ausschließlich in die
serverseitige Supabase-Konfiguration und niemals in eine `VITE_*`-Variable.

## Identitäten und Mitgliedschaften

- Fachliche Fremdschlüssel referenzieren ausschließlich die Supabase User UUID.
- E-Mail-Adressen sind keine stabilen oder eindeutigen Benutzer-IDs.
- Eine erfolgreiche OIDC-Anmeldung erzeugt keine Teammitgliedschaft.
- Ein Nutzer erhält Zugriff nur über eine vorhandene Einladung oder eine
  explizite Mitgliedschaft.
- OIDC-Gruppen oder frei gelieferte Rollen-Claims werden im MVP nicht direkt in
  Workspace-Rollen übersetzt.

## Sicherheitsregeln

- Authorization Code Flow mit PKCE verwenden.
- Nonce-Prüfung nicht deaktivieren.
- Redirect-URLs in Supabase und beim Provider exakt begrenzen.
- Nur HTTPS verwenden, ausgenommen lokale Entwicklung.
- Issuer und Provider-Konfiguration werden administrativ verwaltet.
- Provider-Tokens werden weder in der Datenbank noch in Logs gespeichert.
- Logout und Entzug einer Workspace-Mitgliedschaft bleiben getrennte Vorgänge.
