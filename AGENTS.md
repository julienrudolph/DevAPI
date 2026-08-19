# AGENTS.md – Kollaborativer API-Client

## 1. Zweck dieses Dokuments

Diese Datei definiert die verbindlichen Rahmenbedingungen für Entwicklung, Architektur und Qualität dieses Projekts. Sie gilt für alle Personen und Coding-Agenten, die in diesem Repository arbeiten.

Bei Änderungen gelten folgende Prioritäten:

1. Sicherheit und Mandantentrennung
2. Schutz von Nutzerdaten und lokalen Entwürfen
3. Korrekte Konflikterkennung
4. Verständliche, einfache Bedienung
5. Wartbarkeit und Testbarkeit
6. Entwicklungsgeschwindigkeit

Wenn eine gewünschte Änderung diesen Regeln widerspricht oder den MVP-Scope deutlich erweitert, muss dies vor der Implementierung transparent gemacht werden.

## 2. Produktziel

Das Produkt ist ein schlanker, serverbasierter und kollaborativer REST-API-Client. Teams sollen API-Requests in gemeinsamen Workspaces zentral erstellen, organisieren, bearbeiten und ausführen können, ohne Dateien manuell auszutauschen. Die React-Oberfläche wird als Web-App und zusätzlich über einen abgesicherten Electron-Desktop-Client angeboten; beide verwenden denselben zentralen DevAPI-Server.

Die Zusammenarbeit erfolgt über gemeinsam gespeicherte Daten. Eine gleichzeitige Live-Bearbeitung desselben Requests ist nicht vorgesehen. Parallele Änderungen werden über Versionsnummern erkannt und müssen bewusst durch Nutzer aufgelöst werden.

Der erste nutzbare Stand soll kleinen Teams ermöglichen, das Produkt im Arbeitsalltag als einfache Alternative zu Postman einzusetzen.

## 3. MVP-Scope

### 3.1 Kernfunktionen

Der MVP umfasst:

- Registrierung, Anmeldung und Abmeldung
- Teams beziehungsweise Organisationen
- Einladungen und Mitgliedschaften
- Rollen `owner`, `editor` und `viewer`
- gemeinsame Team-Workspaces
- Collections und verschachtelbare Ordner
- REST-Requests mit mindestens `GET`, `POST`, `PUT`, `PATCH` und `DELETE`
- URL, Query-Parameter, Header und Request-Body
- JSON- und Text-Body; Form-Daten nur, wenn ohne Scope-Risiko umsetzbar
- Basic Auth und Bearer Token
- Response-Ansicht mit Statuscode, Laufzeit, Headern und Body
- Umgebungen und Variablen
- Trennung zwischen geteilten und persönlichen Variablen
- Request-Historie beziehungsweise letzte Ausführungen in einem klar begrenzten Umfang
- Metadaten wie `created_by`, `updated_by`, `created_at` und `updated_at`
- optimistisches Locking für bearbeitbare, gemeinsam genutzte Ressourcen
- HTTP `409 Conflict` bei veralteten Schreibzugriffen
- manueller Vergleich und manuelle Auflösung von Konflikten
- Request-Revisions als Sicherheitsnetz
- serverseitige Ausführung externer Requests über ein separates, abgesichertes Proxy-Backend
- klare Lade-, Fehler-, Leer- und Berechtigungszustände in der Oberfläche
- vollständig selbst gehosteter Serverbetrieb ohne verpflichtende Cloudressourcen
- Electron-Client für denselben zentralen Server

### 3.2 Kollaborationsmodell

- Teammitglieder arbeiten auf demselben zentral gespeicherten Datenbestand.
- Gespeicherte Änderungen sind nach erneutem Laden oder Aktualisieren für andere Mitglieder sichtbar.
- Optional dürfen Aktualisierungshinweise über Polling oder Supabase Realtime übertragen werden.
- Eingaben eines anderen Nutzers dürfen niemals ungefragt in einen lokalen, ungespeicherten Entwurf übernommen werden.
- Realtime darf höchstens als Benachrichtigung dienen, nicht als CRDT- oder Live-Merge-System.

## 4. Nicht-Ziele des MVP

Folgende Funktionen gehören ausdrücklich nicht zum MVP:

- gleichzeitige Live-Bearbeitung
- Live-Cursor, Presence und CRDTs
- automatische Konfliktauflösung
- GraphQL-, gRPC- oder WebSocket-Clients
- Pre-Request- und Post-Response-Skripte
- umfassender Test-Runner
- Mock-Server und API-Monitoring
- Git-Synchronisierung
- Plugin-System
- CLI
- lokaler Agent
- Offline-Modus
- vollständiges Vault- oder Secret-Management
- SSO, SCIM und andere Enterprise-Identitätsfunktionen
- komplexe Governance- oder Audit-Funktionen
- öffentliches Teilen ohne Authentifizierung

Neue Funktionen aus dieser Liste benötigen eine bewusste Scope-Entscheidung und dürfen nicht nebenbei eingeführt werden.

Die Electron-Desktop-App wurde als bewusste Scope-Erweiterung freigegeben. Ihre
erste Stufe ist ausschließlich ein installierbarer Client für den zentralen
DevAPI-Server.

Die lokale Request-Ausführung gegen `localhost` und private Netze wurde als
weitere, bewusste Scope-Erweiterung freigegeben (siehe 11.1a) und ist
ausschließlich dem Desktop-Client vorbehalten. Die Web-Variante bleibt
weiterhin ausschließlich auf den serverseitigen Proxy beschränkt, da ein
Browser lokale Ziele wegen CORS strukturell nicht zuverlässig erreichen kann.
Ein zusätzlicher, separat zu installierender lokaler Agent, der auch der
Web-Variante lokale Ausführung ermöglichen würde, bleibt bewusst zurückgestellt
(siehe Nicht-Ziele) und benötigt eine eigene Scope-Entscheidung.

Die mehrsprachige Oberfläche (Deutsch, Englisch, erweiterbar) wurde ebenfalls
als bewusste Scope-Erweiterung freigegeben. Übersetzte Playwright-Tests oder
mehrsprachige Server-/E-Mail-Inhalte gehören nicht automatisch dazu und
benötigen eine eigene Scope-Entscheidung.

## 5. Verbindlicher Technologie-Stack

### 5.1 Frontend

- React
- TypeScript im Strict Mode
- Vite
- React Router für Routing
- TanStack Query für Server-State, Caching und Mutations
- React Hook Form für Formulare
- Zod für Laufzeitvalidierung und Schemas
- Zustand ausschließlich für lokalen, übergreifenden UI-State
- Fluent UI React v9 (`@fluentui/react-components`) als Komponentenbasis
- Fluent System Icons für neue Standardaktionen; bestehende Lucide-Icons
  werden bei Arbeiten am jeweiligen Feature schrittweise ersetzt
- Monaco Editor für JSON- und Textbearbeitung
- Electron für den installierbaren Desktop-Client
- i18next / react-i18next für die mehrsprachige Oberfläche (Deutsch als
  Standard, zusätzlich Englisch, erweiterbar um weitere Sprachen)

TanStack Query ist die Quelle für geladenen Server-State. Zustand darf keine zweite, dauerhaft synchronisierte Kopie von Serverdaten enthalten. Lokale Formulare und ungespeicherte Entwürfe bleiben im Formular beziehungsweise in einem gezielt dafür vorgesehenen lokalen Editor-State.

### 5.2 Backend und Daten

- Supabase Auth für Authentifizierung
- PostgreSQL als persistente Datenbank
- Supabase Row Level Security als zusätzliche, verpflichtende Autorisierungsschicht
- separates API-Backend für kontrollierte Schreiboperationen und Geschäftslogik
- separates beziehungsweise logisch isoliertes Proxy-Backend für die Ausführung von HTTP-Requests

Konfliktkritische Schreiboperationen, Revisionsanlage, Rollenprüfung und Force-Overwrite dürfen nicht ausschließlich durch direkten Browserzugriff auf Tabellen umgesetzt werden.

### 5.3 Architekturprinzipien

- Das Frontend ist eine Single-Page Application.
- Fachlogik liegt nicht in UI-Komponenten.
- Autorisierung wird serverseitig und über RLS durchgesetzt, niemals nur über ausgeblendete Schaltflächen.
- Externe HTTP-Requests laufen nicht direkt aus dem Browser, wenn CORS oder Sicherheitsanforderungen dies verhindern.
- API-Grenzen verwenden validierte, typisierte Ein- und Ausgaben.
- Privilegierte Supabase-Schlüssel dürfen niemals an den Browser ausgeliefert werden.

## 6. Empfohlene Projektstruktur

Die genaue Aufteilung darf mit wachsendem Projekt angepasst werden. Bevorzugt wird eine Feature-orientierte Struktur:

```text
/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── routes/
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── teams/
│   │       │   ├── workspaces/
│   │       │   ├── collections/
│   │       │   ├── requests/
│   │       │   ├── environments/
│   │       │   ├── conflicts/
│   │       │   └── history/
│   │       ├── components/
│   │       │   ├── ui/
│   │       │   ├── layout/
│   │       │   └── editors/
│   │       ├── lib/
│   │       ├── hooks/
│   │       └── types/
│   ├── api/
│   ├── proxy/
│   └── desktop/
├── packages/
│   ├── contracts/
│   ├── config/
│   └── test-utils/
├── supabase/
│   ├── migrations/
│   ├── policies/
│   └── seed/
├── docs/
└── AGENTS.md
```

Falls zunächst kein Monorepo benötigt wird, darf das Frontend direkt unter `src/` liegen. Trotzdem sind Features, API-Verträge und Sicherheitsgrenzen sauber zu trennen. Eine spätere Migration in die obige Struktur darf nicht durch unnötig enge Kopplung erschwert werden.

## 7. Fachliches Datenmodell

Mindestens folgende Entitäten sind vorzusehen:

- `profiles`
- `teams`
- `team_members`
- `team_invitations`
- `workspaces`
- `workspace_members`, falls Berechtigungen nicht ausschließlich aus dem Team abgeleitet werden
- `collections`
- `folders`
- `requests`
- `environments`
- `environment_variables`
- `request_revisions`
- `request_executions` beziehungsweise eine begrenzte Request-Historie

### 7.1 Gemeinsame Felder

Gemeinsam genutzte fachliche Datensätze erhalten, wo sinnvoll:

```text
id
team_id
workspace_id
created_by
updated_by
created_at
updated_at
version
```

- IDs sind stabile, nicht erratbare Identifikatoren, bevorzugt UUIDs.
- Mandantenbezogene Ressourcen müssen eindeutig einem Team und Workspace zugeordnet sein.
- Fremdschlüssel, Eindeutigkeitsregeln und sinnvolle Löschregeln werden in der Datenbank erzwungen.
- Zeitstempel werden serverseitig in UTC erzeugt.
- `version` ist eine monoton steigende Ganzzahl und beginnt bei `1`.

### 7.2 Requests

Ein Request enthält mindestens:

```text
id
workspace_id
collection_id
folder_id
name
method
url
query_params
headers
auth_config
body_type
body
version
created_by
updated_by
created_at
updated_at
```

Flexible Strukturen wie Header und Query-Parameter dürfen als `jsonb` gespeichert werden, benötigen aber trotzdem ein versioniertes Zod-Schema an der API-Grenze.

### 7.3 Umgebungsvariablen und Secrets

Variablen müssen fachlich unterscheiden zwischen:

- geteilten, nicht geheimen Teamwerten
- persönlichen Werten eines Nutzers
- sensiblen Werten

Ein persönlicher oder geheimer Wert darf niemals automatisch in eine geteilte Ressource kopiert werden. Sensible Werte dürfen nicht in Revisionen, Aktivitätsdaten, Fehlerberichte oder Server-Logs gelangen. Bis ein echtes Secret-Management existiert, muss die Oberfläche deutlich kennzeichnen, welche Werte geteilt werden. Unsichere Secret-Speicherung darf nicht als Vault bezeichnet werden.

### 7.4 Datenaufbewahrung und Löschung

Team- und Workspace-Löschung sowie die selbstständige Löschung des eigenen Kontos sind reguläre Produktfunktionen, keine reinen Admin-Operationen.

**Team-/Workspace-Löschung** darf nur der Owner eines Teams auslösen (siehe Rollentabelle in Abschnitt 8). Sie ist sofort wirksam und entfernt per Datenbank-Kaskade alle untergeordneten Ressourcen (Workspaces, Collections, Ordner, Requests, Umgebungen, Ausführungshistorie, Einladungen).

**Selbstständige Kontolöschung** folgt diesen Regeln:

- Löschung ist sofort wirksam und unwiderruflich; es gibt kein verzögertes Soft-Delete-Fenster.
- Der Nutzer muss zur Bestätigung seine eigene, bereits verifizierte E-Mail-Adresse in das Löschformular eingeben; eine rein clientseitige Bestätigung genügt nicht.
- Ist der Nutzer alleiniger Owner (`role = 'owner'`) mindestens eines Teams, wird die Löschung blockiert. Der Nutzer muss zuvor die Owner-Rolle übertragen oder das betroffene Team löschen.
- Geteilte Inhalte, die der gelöschte Nutzer erstellt oder zuletzt geändert hat (`created_by`, `updated_by`, `executed_by` in `teams`, `workspaces`, `collections`, `folders`, `requests`, `request_revisions`, `environments`, `environment_variables`, `request_executions`, `team_invitations`), bleiben für die verbleibenden Teammitglieder vollständig erhalten. Die Zuordnung wird anonymisiert: die jeweilige Spalte wird `NULL` (`on delete set null`), die API liefert dafür eine generische Anzeige wie „Gelöschter Nutzer“.
- Rein persönliche oder mitgliedschaftsbezogene Daten des Nutzers (`team_members.user_id`, `workspace_members.user_id`, personal-scope `environment_variables.owner_user_id`) werden dagegen per Kaskade mitgelöscht, da sie ohne den Nutzer keinen Sinn ergeben.
- Die eigentliche Löschung des Auth-Kontos erfolgt über die Supabase Admin API (`auth.admin.deleteUser`), nicht per rohem SQL-`DELETE` auf `auth.users`, damit GoTrue-interner Zustand (Sessions, Identities, MFA-Faktoren) konsistent bleibt. Dafür ist serverseitig ein `SUPABASE_SERVICE_ROLE_KEY` erforderlich (siehe Abschnitt 11.4); ohne diesen ist die Funktion deaktiviert und meldet dies dem Client explizit, statt fehlzuschlagen.

## 8. Rollen und Berechtigungen

Die minimalen Workspace-Rollen sind:

| Aktion | Owner | Editor | Viewer |
|---|:---:|:---:|:---:|
| Workspace und Requests ansehen | Ja | Ja | Ja |
| Requests ausführen | Ja | Ja | Ja |
| Requests, Collections und Ordner ändern | Ja | Ja | Nein |
| Geteilte (shared) Umgebungsvariablen ändern | Ja | Ja | Nein |
| Eigene (personal) Umgebungsvariablen anlegen/ändern | Ja | Ja | Ja |
| Konflikt bewusst überschreiben | Ja | Ja | Nein |
| Mitglieder und Rollen verwalten | Ja | Nein | Nein |
| Workspace oder Team löschen | Ja | Nein | Nein |

Jedes Mitglied darf unabhängig von seiner Rolle beliebig viele eigene
`personal`-scope Umgebungsvariablen in jeder für ihn sichtbaren Umgebung
anlegen und ändern. Diese Werte sind nur für das anlegende Mitglied selbst
lesbar und überschreiben lokal eine gleichnamige geteilte Variable.

Zusätzliche Regeln:

- Jede Backend-Operation prüft Authentifizierung, Mitgliedschaft und erforderliche Rolle.
- Jede relevante Tabelle besitzt aktivierte und getestete RLS-Policies.
- Service-Role-Zugriff umgeht RLS und darf daher nur in vertrauenswürdigen Serverkomponenten verwendet werden.
- Der Client darf aus UI-Zuständen keine Berechtigung ableiten, die der Server nicht bestätigt.
- Objekt-IDs allein gewähren niemals Zugriff.
- Cross-Tenant-Zugriffe müssen durch automatisierte Negativtests abgedeckt sein.

## 9. Konfliktstrategie

### 9.1 Optimistisches Locking

Jede Änderung an einem gemeinsam bearbeitbaren Datensatz sendet dessen geladene Version als `expectedVersion`.

Das Update muss atomar erfolgen:

```sql
update requests
set
  ...,
  version = version + 1,
  updated_by = :user_id,
  updated_at = now()
where id = :request_id
  and version = :expected_version;
```

Werden keine Zeilen aktualisiert, darf die Änderung nicht still überschrieben werden. Die API antwortet mit HTTP `409 Conflict`.

### 9.2 Konfliktantwort

Eine Konfliktantwort enthält mindestens:

```json
{
  "code": "REQUEST_VERSION_CONFLICT",
  "message": "Der Request wurde zwischenzeitlich geändert.",
  "expectedVersion": 7,
  "currentVersion": 8,
  "current": {},
  "updatedBy": {},
  "updatedAt": "..."
}
```

Die Antwort darf nur Daten enthalten, die der anfragende Nutzer weiterhin lesen darf.

### 9.3 Manuelle Auflösung

Bei einem Konflikt:

- bleibt der lokale Entwurf vollständig erhalten
- wird nichts automatisch zusammengeführt
- zeigt die UI die lokale und die aktuelle Team-Version vergleichbar an
- werden abweichende Kernfelder nach Möglichkeit kenntlich gemacht
- kann der Nutzer die Serverversion laden und lokale Änderungen verwerfen
- kann der Nutzer zum Editor zurückkehren und manuell anpassen
- kann ein berechtigter Nutzer die eigene Version nach ausdrücklicher Bestätigung speichern

Ein bewusstes Überschreiben muss auf der inzwischen aktuellen Version aufbauen und erneut atomar geprüft werden. Ein `force`-Flag darf niemals die Autorisierung, die Revisionsanlage oder jede weitere Versionsprüfung umgehen.

### 9.4 Aktualisierungshinweise

Polling oder Supabase Realtime darf anzeigen, dass eine neuere Version existiert. Ein Refetch darf einen `dirty` oder `conflicted` markierten Editor nicht ungefragt ersetzen.

Empfohlene Editor-Zustände:

```ts
type EditorStatus =
  | "clean"
  | "dirty"
  | "saving"
  | "conflicted"
  | "error";
```

Navigation, Tab-Schließen und Request-Wechsel müssen ungespeicherte Änderungen berücksichtigen.

## 10. Request-Revisions

Vor jeder erfolgreichen Änderung eines Requests wird die vorherige Fassung in derselben Datenbanktransaktion als unveränderlicher Snapshot gespeichert.

Eine Revision enthält mindestens:

```text
id
request_id
version
snapshot
created_by
created_at
change_type
```

Regeln:

- Revision und Update sind atomar.
- Revisionen werden nicht nachträglich verändert.
- Sensible persönliche Werte und Secrets dürfen nicht in Snapshots aufgenommen werden.
- Wiederherstellen erzeugt eine neue Request-Version; es schreibt die Historie nicht um.
- Force-Overwrite erzeugt ebenfalls eine Revision.
- Aufbewahrung und eventuelle Größenlimits müssen bewusst definiert werden.

## 11. Sicherheitsanforderungen

### 11.1 SSRF-Schutz des Proxy-Backends

Das Proxy-Backend ist die sicherheitskritischste Komponente. Es darf nicht als offener Proxy oder Zugang zu internen Netzen nutzbar sein.

Mindestens erforderlich:

- nur authentifizierte und berechtigte Nutzer dürfen Requests ausführen
- nur erlaubte Protokolle, zunächst `http` und `https`
- Blockieren von Loopback-, Link-Local-, privaten, reservierten, Multicast- und nicht routbaren IP-Bereichen für IPv4 und IPv6
- Blockieren von `localhost`, lokalen Domains und Cloud-Metadatenendpunkten
- DNS-Auflösung vor dem Verbindungsaufbau und Prüfung aller aufgelösten Adressen
- erneute Prüfung jedes Redirect-Ziels
- Schutz vor DNS Rebinding; die tatsächlich verbundene Adresse muss der geprüften Adresse entsprechen
- begrenzte Redirect-Anzahl
- Verbot von Nutzerinformationen in URLs, wenn nicht ausdrücklich sicher unterstützt
- Limits für Request- und Response-Größe
- Verbindungs-, Gesamt- und Leerlauf-Timeouts
- begrenzte Parallelität und Rate Limits pro Nutzer beziehungsweise Team
- keine Weitergabe interner Proxy-Header
- kontrollierte Liste zulässiger HTTP-Methoden
- kein Zugriff auf lokale Dateien oder Nicht-HTTP-Protokolle
- Abbruch von Streams bei Überschreitung der Limits
- sichere, redigierte Protokollierung

Für lokale Entwicklungsserver oder private Team-Netze ist später ein lokaler Agent oder eine explizit abgesicherte Netzwerkfunktion erforderlich. Der öffentliche MVP-Proxy darf diese Ziele nicht freischalten.

### 11.1a Lokale Ausführung im Desktop-Client

Der Electron-Desktop-Client darf Requests wahlweise direkt aus seinem
Main-Prozess ausführen, statt sie über `apps/proxy` zu leiten. Das ist die
einzige vorgesehene Möglichkeit, private und Loopback-Ziele zu erreichen; die
Web-Variante bleibt dafür ausschließlich auf den Server-Proxy beschränkt.

Auswahl des Ausführungswegs:

- Standardmäßig automatische Erkennung: löst das Ziel zu einer privaten,
  Loopback- oder Link-Local-Adresse auf, wird lokal ausgeführt; alle anderen
  Ziele laufen weiterhin über den Server-Proxy.
- Zusätzlich immer ein expliziter, sichtbarer Umschalter pro Request, mit dem
  Nutzer den erkannten Ausführungsweg bewusst überschreiben können.

Auch bei lokaler Ausführung bleiben folgende Schutzmaßnahmen verpflichtend,
nur die Freigabe privater/Loopback-Bereiche entfällt gegenüber 11.1:

- Cloud-Metadatenendpunkte bleiben blockiert.
- nur `http` und `https` als Protokoll.
- Verbindungs-, Gesamt- und Leerlauf-Timeouts.
- Limits für Request- und Response-Größe.
- Verbot von Nutzerinformationen in URLs.
- sichere, redigierte Protokollierung; keine Zugangsdaten oder Response-Bodies
  in der geteilten Ausführungshistorie.

Lokal ausgeführte Requests erzeugen denselben Eintrag in der geteilten
Ausführungshistorie wie über den Proxy ausgeführte Requests. Das bestehende
Schema speichert dort ohnehin nur Metadaten (Request-Name, Methode,
Statuscode, Dauer, ausführende Person, Zeitpunkt), keine Bodies, Header oder
vollständigen URLs — dadurch ergibt sich durch die lokale Ausführung kein
zusätzliches Datenschutzrisiko für geteilte Workspaces.

### 11.2 CORS

- CORS ist keine Autorisierung.
- Das eigene Backend akzeptiert nur bekannte Frontend-Ursprünge.
- Credentials und Wildcard-Origin dürfen nicht kombiniert werden.
- Preflight- und zugelassene Header werden minimal gehalten.
- Ziel-APIs werden serverseitig angesprochen; ihre CORS-Regeln dürfen nicht durch unsichere Browser-Tricks umgangen werden.

### 11.3 Authentifizierung und Sessions

- Tokens und Sessions werden nach den aktuellen Supabase-Empfehlungen behandelt.
- Keine langlebigen privilegierten Tokens im Browser oder Repository.
- Server prüft Tokens unabhängig und vertraut keinen vom Client gesendeten Nutzer- oder Rollen-IDs.
- Logout, Tokenablauf und entzogene Mitgliedschaften müssen sauber behandelt werden.

### 11.4 Secrets und Protokollierung

Folgendes darf nicht im Klartext geloggt werden:

- `Authorization`- und Cookie-Header
- API-Keys und Tokens
- Passwörter
- persönliche Umgebungsvariablen
- Request- oder Response-Bodies mit potenziell sensiblen Daten
- Supabase-Service-Role-Schlüssel

Logs verwenden Allowlisting statt einer unvollständigen Blocklist. Fehlermeldungen an Clients geben keine internen Adressen, Stacktraces, Datenbankdetails oder Secret-Werte preis.

### 11.5 Allgemeine Websicherheit

- Eingaben werden an jeder Vertrauensgrenze mit Zod oder gleichwertig validiert.
- JSON und Text aus Responses werden niemals ungeprüft als HTML gerendert.
- URL- und Header-Eingaben werden gegen Header Injection und ungültige Zeichen geprüft.
- Datenbankzugriffe sind parametrisiert.
- Abhängigkeiten und Migrationen werden geprüft und reproduzierbar versioniert.
- Zustandsändernde Endpunkte werden gegen CSRF geschützt, sofern die gewählte Session-Strategie dies erfordert.
- Kritische Aktionen wie Löschen oder Force-Overwrite benötigen eine bewusste Bestätigung.

## 12. Frontend- und UX-Konventionen

- Funktionskomponenten und Hooks verwenden.
- Komponenten klein und auf eine klar erkennbare Aufgabe begrenzen.
- Features kapseln ihre UI, Hooks, Schemas, API-Zugriffe und Tests.
- Gemeinsame UI-Primitiven kommen aus `components/ui`; keine unnötigen Parallelkomponenten.
- Die Anwendung wird zentral durch einen `FluentProvider` mit dem Relay-Theme
  versorgt. Features verwenden bevorzugt die Wrapper aus `components/ui`,
  damit produktbezogene Varianten und Fluent UI nicht an jeder Aufrufstelle
  neu gekoppelt werden.
- Layout-CSS bleibt für Workbench, Sidebar, Monaco und responsive Anordnung
  zulässig. Interaktive Standardkomponenten, Fokusmanagement, Dialoge, Menüs,
  Tabs und Formfelder basieren auf Fluent UI.
- Serverdaten werden über TanStack Query gelesen und verändert.
- Query Keys werden zentral und typsicher erzeugt.
- Mutations aktualisieren oder invalidieren genau die betroffenen Queries.
- Automatische Refetches dürfen keine lokalen Entwürfe zerstören.
- Formulardaten werden mit React Hook Form und Zod validiert.
- Zustand ist nur für echten lokalen UI-State zulässig, zum Beispiel Panelbreiten, aktive lokale Tabs oder Dialogzustände.
- URL-relevanter Zustand gehört in Router beziehungsweise Search Params.
- Monaco wird verzögert geladen, wenn dies die Startleistung verbessert.
- Tastaturbedienung, sichtbare Fokuszustände, Labels und ausreichender Kontrast sind Pflicht.
- Fehlertexte sollen handlungsorientiert sein und technische Details nur zeigen, wenn sie Nutzern helfen.
- Die Anwendung muss zwischen `loading`, `empty`, `error`, `forbidden`, `dirty`, `saving` und `conflicted` unterscheiden.
- Sichtbare UI-Texte werden nicht hartcodiert, sondern über `useTranslation`
  (in reinen Funktionen über die `i18n`-Instanz) aus Feature-Namespace-JSON
  unter `apps/web/src/locales/<sprache>/<namespace>.json` bezogen. Deutsche
  Werte bleiben beim Hinzufügen neuer Übersetzungen möglichst wortgleich zu
  bestehenden Texten, damit bestehende Tests stabil bleiben.

## 13. TypeScript- und Coding-Konventionen

- TypeScript `strict` bleibt aktiviert.
- Kein `any`, außer an dokumentierten Integrationsgrenzen und nur mit unmittelbarer Validierung.
- Öffentliche Funktionen, API-Verträge und komplexe Rückgaben erhalten explizite Typen.
- Laufzeitdaten aus Netzwerk, Storage oder Umgebungsvariablen gelten als `unknown`, bis sie validiert sind.
- Zod-Schemas sind die Quelle der Wahrheit für Laufzeitverträge; Typen werden daraus abgeleitet, wenn sinnvoll.
- Domänennamen sind eindeutig und konsistent: `team`, `workspace`, `collection`, `folder`, `request`, `revision`.
- Keine Geschäftslogik in generischen UI-Komponenten.
- Keine verdeckten Seiteneffekte in Renderpfaden.
- Fehler werden typisiert und an zentralen Grenzen in sichere API-Antworten übersetzt.
- Kommentare erklären Gründe und Sicherheitsentscheidungen, nicht offensichtlichen Code.
- Keine Secrets, Zugangsdaten oder echte Kundendaten in Quellcode, Fixtures oder Screenshots.
- Datenbankänderungen erfolgen ausschließlich über nachvollziehbare Migrationen.
- Neue Abhängigkeiten benötigen einen klaren Nutzen und eine Prüfung von Wartung, Größe, Lizenz und Sicherheitsrisiko.

Formatierung, Linting und Imports werden automatisiert vereinheitlicht. Bestehende Projektwerkzeuge sind zu verwenden; konkurrierende Formatter oder Linter werden nicht parallel eingeführt.

## 14. API-Konventionen

- JSON-basierte, versionierbare Verträge
- konsistente Ressourcen- und Fehlerformate
- korrekte HTTP-Methoden und Statuscodes
- `401` für fehlende oder ungültige Authentifizierung
- `403` für fehlende Berechtigung
- `404` darf verwendet werden, um fremde Ressourcen nicht offenzulegen
- `409` für Versionskonflikte
- `422` oder `400` für validierte Eingabefehler, projektweit einheitlich
- keine vertrauenswürdige Übernahme von `created_by`, `updated_by`, `team_id` oder Rollen aus Clientdaten
- Idempotenz bei Wiederholungen berücksichtigen, besonders bei Einladungen und Request-Ausführung
- Correlation IDs für Diagnose, ohne sensible Daten zu protokollieren

Gemeinsame API-Verträge sollen in einem dedizierten Paket oder klar abgegrenzten Modul liegen. Frontend und Backend dürfen nicht durch das Importieren interner Implementierungen gekoppelt werden.

## 15. Testing-Strategie

Tests sind Teil der Implementierung und keine spätere Zusatzaufgabe.

### 15.1 Unit-Tests

Mindestens für:

- Zod-Schemas und Normalisierung
- Variablenauflösung
- Konflikt- und Versionslogik
- Rollenentscheidungen
- Redaction sensibler Werte
- URL-, IP- und Redirect-Prüfung des SSRF-Schutzes
- Diff-Aufbereitung für die Konfliktanzeige

### 15.2 Komponenten- und Integrationstests

Mindestens für:

- Request-Editor und Dirty-State
- Speichern einer gültigen Änderung
- Anzeige und Erhalt lokaler Daten bei HTTP `409`
- manuelle Auswahl der Server- oder lokalen Version
- Berechtigungszustände für Owner, Editor und Viewer
- Formularvalidierung
- Fehler-, Lade- und Leerzustände
- Query-Cache-Verhalten ohne Überschreiben lokaler Entwürfe

Netzwerkzugriffe werden an der HTTP-Grenze realistisch simuliert, nicht durch das Mocken interner Implementierungsdetails.

### 15.3 Backend- und Datenbanktests

Mindestens für:

- atomare Versionsupdates
- konkurrierende Schreibversuche
- Revisionsanlage in derselben Transaktion
- RLS für jede Rolle
- Cross-Tenant- und IDOR-Negativfälle
- entzogene Mitgliedschaften
- Force-Overwrite mit und ohne Berechtigung
- Transaktions-Rollback bei Fehlern

### 15.4 Proxy-Sicherheitstests

Mindestens für:

- Loopback und private IPv4-Bereiche
- IPv6-Loopback, Link-Local und Unique-Local
- alternative IP-Darstellungen
- DNS-Antworten mit gemischten erlaubten und blockierten Adressen
- Redirect von öffentlichem zu internem Ziel
- Cloud-Metadatenadressen
- DNS-Rebinding-Szenarien soweit technisch testbar
- übergroße Requests und Responses
- Timeouts, Redirect-Limits und Abbruch
- Header-Redaction
- nicht erlaubte Protokolle

Für die lokale Ausführung im Desktop-Client (11.1a) gelten dieselben
Anforderungen mit umgekehrter Erwartung bei privaten/Loopback-Bereichen
(erlaubt statt blockiert), Cloud-Metadatenadressen bleiben aber weiterhin ein
Negativtestfall.

### 15.5 End-to-End-Tests

Die kritischen Nutzerpfade werden mit einem Browser-Test abgedeckt:

1. anmelden und Workspace öffnen
2. Collection, Ordner und Request erstellen
3. Request speichern und ausführen
4. Response ansehen
5. parallele Änderung simulieren
6. Konflikt erkennen und manuell auflösen
7. Viewer darf lesen und ausführen, aber nicht ändern
8. Nutzer eines anderen Teams kann die Ressource nicht lesen

## 16. Definition of Done

Eine Änderung ist erst fertig, wenn:

- die Akzeptanzkriterien erfüllt sind
- der Code zum festgelegten Scope und zur Architektur passt
- Typprüfung, Linting und relevante Tests erfolgreich sind
- neue Logik angemessen automatisiert getestet ist
- Datenbankänderungen eine Migration, passende RLS-Policies und Rollback-Überlegungen enthalten
- Berechtigungen serverseitig geprüft sind
- Fehler-, Lade-, Leer- und Berechtigungszustände berücksichtigt wurden
- lokale Entwürfe nicht durch Refetch oder Fehler verloren gehen
- sensible Daten weder geloggt noch unbeabsichtigt geteilt werden
- Sicherheitsauswirkungen geprüft und bei Proxy-, Auth-, RLS- oder Secret-Änderungen dokumentiert sind
- Nutzeroberflächen per Tastatur bedienbar sind und grundlegende Barrierefreiheit erfüllen
- keine unnötige neue Abhängigkeit oder Scope-Erweiterung eingeführt wurde
- relevante Dokumentation und API-Verträge aktualisiert sind
- die Änderung in einer produktionsnahen Umgebung nachvollziehbar verifiziert wurde

Für Proxy-, Authentifizierungs-, Autorisierungs-, RLS- und Konfliktlogik ist ein erfolgreicher Happy-Path-Test allein nicht ausreichend. Negative Sicherheits- und Parallelitätstests sind Pflicht.

## 17. MVP-Meilensteine

### Meilenstein 0 – Fundament

- Repository- und Paketstruktur
- React-, TypeScript- und Vite-Grundlage
- Routing, Query-Provider, UI-Basis und Testwerkzeuge
- lokale Entwicklungsumgebung
- lokale und selbst gehostete Supabase-Konfiguration sowie Migrationen
- CI für Typprüfung, Linting, Tests und Build

Ergebnis: reproduzierbares, getestetes Projektgerüst.

### Meilenstein 1 – Authentifizierung und Mandantentrennung

- Registrierung und Login
- Profile, Teams und Mitgliedschaften
- Einladungsfluss
- Rollenmodell
- erste RLS-Policies und Cross-Tenant-Tests

Ergebnis: Nutzer können sicher in voneinander getrennten Teams arbeiten.

### Meilenstein 2 – Workspaces und Organisation

- Workspaces
- Collections und Ordner
- Request-Liste und Navigation
- Owner-, Editor- und Viewer-Verhalten

Ergebnis: Teams können gemeinsame API-Strukturen anlegen und verwalten.

### Meilenstein 3 – Request-Editor

- Methode, URL, Query-Parameter, Header und Body
- Basic Auth und Bearer Token
- React Hook Form, Zod und Monaco
- Dirty-State und Navigationsschutz
- Umgebungen sowie persönliche und geteilte Variablen

Ergebnis: Requests können sicher erstellt, validiert und gespeichert werden.

### Meilenstein 4 – Ausführung und Response-Ansicht

- abgesichertes Proxy-Backend
- SSRF-, Größen-, Timeout-, Redirect- und Rate-Limit-Schutz
- Variablenauflösung
- Response-Status, Laufzeit, Header und Body
- redigierte Fehler und Logs

Ergebnis: Berechtigte Nutzer können öffentliche REST-Endpunkte kontrolliert ausführen.

### Meilenstein 5 – Konflikte und Revisionen

- Versionsfeld und atomare Updates
- HTTP-`409`-Verträge
- Konfliktdialog und Vergleichsansicht
- bewusste Auflösung und Überschreibung
- unveränderliche Request-Revisions
- Parallelitäts- und Rollback-Tests

Ergebnis: Gleichzeitige Änderungen führen nicht zu stillem Datenverlust.

### Meilenstein 6 – Stabilisierung des internen MVP

- kritische End-to-End-Tests
- Performance- und Sicherheitsprüfung
- Fehlerbeobachtung ohne Secret-Leaks
- Accessibility- und UX-Polishing
- Deployment, Backups und Wiederherstellungsprobe
- Pilotbetrieb mit einem kleinen Team

Ergebnis: ein intern täglich nutzbarer MVP.

### Meilenstein 7 – Öffentliche Beta

- Feedback aus dem Pilotbetrieb
- belastbarer Einladungs- und Onboarding-Ablauf
- Betriebsmetriken und Rate-Limit-Tuning
- dokumentierte Datenaufbewahrung
- Import und Export, vorzugsweise OpenAPI und gegebenenfalls Postman Collections
- gezielte Stabilitäts- und Usability-Verbesserungen

Ergebnis: eine begrenzt öffentlich nutzbare Beta ohne Erweiterung der festgelegten Nicht-Ziele.

### Meilenstein 8 – Desktop-Verteilung

- Electron-Client gegen denselben zentralen DevAPI-Server
- sichere Main-/Preload-Grenze ohne Node-Zugriff im Renderer
- Windows-Paketierung und Installer-Test
- Code Signing und reproduzierbare Releaseartefakte
- sicherer Callback für OIDC beziehungsweise Magic Links

Ergebnis: ein installierbarer Desktop-Client ohne Aufweichung der serverseitigen Berechtigungs- und Sicherheitsgrenzen.

## 18. Arbeitsweise bei Änderungen

Vor einer Implementierung:

1. Bestehende Architektur, Migrationen und lokale Regeln prüfen.
2. Betroffene Sicherheits- und Mandantengrenzen identifizieren.
3. Akzeptanzkriterien und erforderliche Negativtests festlegen.
4. Die kleinste vollständige Änderung innerhalb des MVP-Scopes wählen.

Während der Implementierung:

- kleine, nachvollziehbare Änderungen bevorzugen
- bestehende unbeteiligte Änderungen erhalten
- Datenbank, Backend und Frontend über explizite Verträge synchron halten
- bei sicherheitskritischen Entscheidungen den Grund dokumentieren

Vor Abschluss:

- relevante Prüfungen tatsächlich ausführen
- Fehler nicht durch Abschalten von Regeln oder Entfernen von Tests verdecken
- bekannte Einschränkungen offen benennen
- keine Funktion als sicher oder fertig bezeichnen, wenn die entscheidenden Negativfälle ungeprüft sind

## 19. Leitentscheidung

Das Produkt optimiert im MVP auf verlässliche gemeinsame Workspaces, nicht auf maximale Funktionsbreite. Die Kombination aus zentraler Speicherung, klaren Rollen, RLS, optimistischem Locking, HTTP `409`, manueller Konfliktauflösung und unveränderlichen Revisionen ist die verbindliche Grundlage der Zusammenarbeit.
