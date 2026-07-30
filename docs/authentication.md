# Authentifizierung

## Verfügbare Verfahren

Die Oberfläche kann drei Verfahren unabhängig anzeigen:

```text
PASSWORD_AUTH_ENABLED=true
PASSWORD_SIGNUP_ENABLED=true
MAGIC_LINK_AUTH_ENABLED=false
```

Die Standardwerte sind für einen einfachen internen Testbetrieb ohne SMTP:

- Anmeldung mit E-Mail und Passwort
- Selbstregistrierung
- keine Magic-Link-E-Mail
- optional zusätzlich OIDC

Neue Passwörter müssen in der DevAPI-Oberfläche mindestens zwölf Zeichen
enthalten. Fehlermeldungen bei der Anmeldung unterscheiden absichtlich nicht
zwischen einem unbekannten Konto und einem falschen Passwort.

Ohne SMTP sind keine Passwort-Wiederherstellung, E-Mail-Bestätigung,
Einladungsmails oder Sicherheitsbenachrichtigungen möglich. Dieser Zustand ist
nicht als endgültige öffentliche Produktionskonfiguration vorgesehen.

## Unterstützte Verfahren

Die Anwendung verwendet Supabase Auth als gemeinsame Sitzungs- und
Identitätsgrenze. Vorgesehen sind:

- E-Mail und Passwort
- optional E-Mail-Anmeldelink
- optional ein benutzerdefinierter OpenID-Connect-Provider

OIDC ist keine parallele lokale Benutzerverwaltung. Supabase Auth führt den
Authorization-Code-Flow aus und stellt anschließend eine normale
Supabase-Session aus. Dadurch bleiben `auth.uid()`, PostgreSQL-RLS und die
Workspace-Rollen für beide Anmeldewege identisch.

## E-Mail-Anmeldelinks

E-Mail-Links zeigen auf `/auth/confirm` und enthalten einen kurzlebigen
`token_hash`. Die Callback-Seite bestätigt ihn über `verifyOtp`, übernimmt die
Supabase-Session und entfernt den Token unmittelbar aus der sichtbaren URL.
Damit funktioniert der Link auch dann, wenn das Postfach in einem anderen Tab
geöffnet ist und dort kein zuvor gespeicherter PKCE-Verifier vorliegt.

Der lokale Compose-Stack liefert dafür eigene Vorlagen aus
`infra/local/auth-templates` aus. Bei Hosted Supabase müssen die Vorlagen für
**Confirm signup** und **Magic link** entsprechend angepasst werden:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">
  Anmelden
</a>
```

Der Token ist einmalig und darf nicht geloggt werden. Abgelaufene oder bereits
verwendete Links führen kontrolliert zurück zur Anmeldung.

## OIDC-Provider konfigurieren

1. In Supabase unter **Auth → Providers** einen neuen Provider anlegen.
2. **Auto-discovery (OIDC)** auswählen.
3. Einen Bezeichner mit `custom:`-Präfix vergeben.
4. Client-ID, Client-Secret und Issuer-URL hinterlegen.
5. Die von Supabase angezeigte Callback-URL beim Identity Provider erlauben.
6. PKCE und Nonce-Prüfung aktiviert lassen.
7. Den Bezeichner in der Serverkonfiguration hinterlegen:

```text
OIDC_PROVIDER=custom:company-oidc
OIDC_LABEL=Mit Firmenkonto anmelden
```

Der Client-Secret des OIDC-Providers gehört ausschließlich in die
serverseitige Supabase-Konfiguration. `VITE_*`-Werte existieren nur als
Fallback für den direkten lokalen Vite-Entwicklungsserver; Docker- und
Desktop-Clients laden die öffentliche Konfiguration zur Laufzeit.

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
