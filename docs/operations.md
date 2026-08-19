# Betrieb: Metriken und Rate-Limit-Tuning

Dieses Dokument beschreibt die verfügbaren Prometheus-Metriken von API und
Proxy sowie einen empfohlenen Ablauf, um die Ausführungslimits aus
[README.md](../README.md#ausführungslimits) anhand echter Betriebsdaten
nachzujustieren (README/AGENTS-Folgearbeit, Meilenstein 7).

## Verfügbare Metriken

Beide Container exponieren `/metrics` im Prometheus-Textformat, geschützt
durch `METRICS_TOKEN` (`Authorization: Bearer <token>`). Der Metrikname ist
je nach Dienst mit `devapi_api_` beziehungsweise `devapi_proxy_` präfixiert.

| Metrik | Typ | Labels | Bedeutung |
|---|---|---|---|
| `<prefix>_http_requests_active` | Gauge | – | Aktuell laufende Requests im Prozess |
| `<prefix>_http_requests_total` | Counter | `method`, `route`, `status` | Abgeschlossene Requests seit Prozessstart |
| `<prefix>_http_request_duration_ms_total` | Counter | `method`, `route`, `status` | Aufsummierte Bearbeitungsdauer in ms für dieselbe Label-Kombination |

Aus den beiden Counter-Metriken lässt sich die durchschnittliche
Bearbeitungsdauer je Route/Status ableiten:

```text
avg_duration_ms = http_request_duration_ms_total / http_requests_total
```

Beide Metriken sind reine In-Prozess-Zähler (kein Histogramm, keine
Persistenz) und setzen sich bei jedem Neustart zurück. Für einen
selbst gehosteten Single-Container-Betrieb reicht das; bei mehreren
API-Replikaten müssten Werte über alle Instanzen aufsummiert werden.

## Relevante Metriken für Rate-Limit-Tuning

Die Ausführungslimits (`EXECUTION_RATE_*`, `EXECUTION_CONCURRENCY_*` in
`apps/api`, `PROXY_MAX_CONCURRENT_REQUESTS` in `apps/proxy`) sollen echte
Nutzung zulassen, ohne dass ein einzelner Nutzer oder Workspace den Proxy für
andere blockiert. Für die Einschätzung sind vor allem relevant:

1. **`devapi_api_http_requests_total{route="/v1/execute",status="429"}`**
   im Verhältnis zu `status!="429"` auf derselben Route: ein spürbarer
   Anteil an `429` deutet darauf hin, dass `EXECUTION_RATE_PER_USER`,
   `EXECUTION_RATE_PER_WORKSPACE`, `EXECUTION_CONCURRENCY_PER_USER` oder
   `EXECUTION_CONCURRENCY_PER_WORKSPACE` für die tatsächliche Nutzung zu
   knapp bemessen sind. Die API-Antwort unterscheidet über den Code
   (`EXECUTION_RATE_LIMITED` vs. `EXECUTION_CONCURRENCY_LIMITED`), welches
   der beiden Limits konkret gegriffen hat; das steht nicht in der Metrik
   selbst, aber in den strukturierten Logs derselben Anfrage.
2. **`devapi_proxy_http_requests_active`** über die Zeit: nähert sich der
   Wert dauerhaft `PROXY_MAX_CONCURRENT_REQUESTS`, ist die globale
   Proxy-Kapazität der begrenzende Faktor, nicht die nutzer- oder
   workspacebezogenen Limits in der API.
3. **`avg_duration_ms` für `route="/v1/execute"`**: ein deutlicher Anstieg
   über mehrere Reviews hinweg kann auf langsame Ziel-APIs oder auf
   Sättigung der Proxy-Kapazität hindeuten, bevor die harten Limits greifen.

Die nutzer- und workspacebezogenen Zähler liegen im Prozessspeicher der API
(siehe README, Abschnitt „Ausführungslimits“) und sind für den vorgesehenen
einzelnen Self-Hosted-API-Container ausgelegt.

## Empfohlener Review-Zyklus

1. **Monatlich** (oder nach einer spürbaren Häufung von Support-Anfragen zu
   `429`-Fehlern): `/metrics` beider Container abfragen und die drei oben
   genannten Werte gegen den vorherigen Review vergleichen.
2. Bei dauerhaft erhöhtem `429`-Anteil auf `/v1/execute`: zunächst prüfen,
   ob ein einzelner Nutzer/Workspace auffällig viele Requests verursacht
   (ungewöhnliches Nutzungsmuster, ggf. fehlerhafte Automatisierung) statt
   die Limits reflexhaft zu erhöhen.
3. Ist die erhöhte Last plausibel (mehr aktive Teams, mehr parallele
   Testläufe): einzelne Umgebungsvariable gezielt erhöhen, nicht alle
   gleichzeitig, damit der Effekt der Änderung im nächsten Review sichtbar
   bleibt.
4. Änderung dokumentieren (z. B. im Deployment-Runbook des Betreibers) und
   im nächsten Review erneut auswerten.
5. Nähert sich `devapi_proxy_http_requests_active` dauerhaft
   `PROXY_MAX_CONCURRENT_REQUESTS`, reicht eine Erhöhung der API-seitigen
   Limits allein nicht aus; `PROXY_MAX_CONCURRENT_REQUESTS` muss ebenfalls
   angepasst und die Host-Ressourcen (CPU, Netzwerk-Sockets) entsprechend
   eingeplant werden.

Dieser Ablauf ersetzt keine Kapazitätsplanung für stark wachsende
Nutzerzahlen; bei mehreren API-Replikaten wird ein gemeinsamer, verteilter
Limiter benötigt (siehe README, Abschnitt „Ausführungslimits“).
