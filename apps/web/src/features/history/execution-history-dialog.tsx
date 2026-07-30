import { Clock3, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useExecutionHistory } from "./execution-history-queries";

export function ExecutionHistoryDialog({
  onClose,
  onOpenRequest,
  workspaceId,
}: {
  onClose: () => void;
  onOpenRequest?: (requestId: string) => void;
  workspaceId: string;
}) {
  const history = useExecutionHistory(workspaceId);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "successful" | "failed">("all");
  const filteredHistory = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (history.data ?? []).filter(
      (execution) =>
        (status === "all" ||
          (status === "successful"
            ? execution.successful
            : !execution.successful)) &&
        (!normalizedQuery ||
          execution.requestName.toLocaleLowerCase().includes(normalizedQuery) ||
          execution.method.toLocaleLowerCase().includes(normalizedQuery) ||
          String(execution.statusCode).includes(normalizedQuery) ||
          execution.executedBy.displayName
            .toLocaleLowerCase()
            .includes(normalizedQuery)),
    );
  }, [history.data, query, status]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="execution-history-title"
        aria-modal="true"
        className="conflict-dialog execution-history-dialog"
        role="dialog"
      >
        <div className="team-members-heading">
          <span className="member-avatar">
            <Clock3 aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 id="execution-history-title">Request-Verlauf</h2>
            <p>Maximal 100 Einträge aus den letzten 30 Tagen.</p>
          </div>
        </div>

        {!history.isPending && !history.isError && history.data.length > 0 ? (
          <div className="history-filters">
            <label>
              <Search aria-hidden="true" size={15} />
              <span className="sr-only">Verlauf durchsuchen</span>
              <input
                aria-label="Verlauf durchsuchen"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Request, Methode, Status, Person"
                type="search"
                value={query}
              />
            </label>
            <select
              aria-label="Verlauf nach Status filtern"
              onChange={(event) =>
                setStatus(
                  event.target.value as "all" | "successful" | "failed",
                )
              }
              value={status}
            >
              <option value="all">Alle Ergebnisse</option>
              <option value="successful">Erfolgreich</option>
              <option value="failed">Fehlgeschlagen</option>
            </select>
          </div>
        ) : null}

        {history.isPending ? (
          <p className="dialog-state">Verlauf wird geladen …</p>
        ) : history.isError ? (
          <p className="field-error">Der Verlauf konnte nicht geladen werden.</p>
        ) : history.data.length === 0 ? (
          <p className="dialog-state">Noch keine Requests ausgeführt.</p>
        ) : filteredHistory.length === 0 ? (
          <p className="dialog-state">Keine passenden Einträge gefunden.</p>
        ) : (
          <div className="execution-history-list">
            {filteredHistory.map((execution) => (
              <article className="execution-history-row" key={execution.id}>
                <span className={`method ${execution.method.toLowerCase()}`}>
                  {execution.method}
                </span>
                <span className="execution-identity">
                  <strong>{execution.requestName}</strong>
                  <small>
                    {execution.executedBy.displayName} ·{" "}
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(execution.executedAt))}
                  </small>
                </span>
                <span
                  className={
                    execution.successful ? "status-ok" : "status-error"
                  }
                >
                  {execution.statusCode}
                </span>
                <span className="execution-duration">
                  {execution.durationMs} ms
                </span>
                {onOpenRequest ? (
                  <button
                    aria-label={`${execution.requestName} öffnen`}
                    className="icon-button compact"
                    onClick={() => {
                      onOpenRequest(execution.requestId);
                      onClose();
                    }}
                    title="Request in einem Tab öffnen"
                    type="button"
                  >
                    <ExternalLink aria-hidden="true" size={14} />
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <p className="security-hint">
          URL, Header, Zugangsdaten sowie Request- und Response-Inhalte werden
          nicht im Verlauf gespeichert.
        </p>
        <div className="dialog-actions">
          <button className="button primary" onClick={onClose} type="button">
            Schließen
          </button>
        </div>
      </section>
    </div>
  );
}
