import { Clock3 } from "lucide-react";

import { useExecutionHistory } from "./execution-history-queries";

export function ExecutionHistoryDialog({
  onClose,
  workspaceId,
}: {
  onClose: () => void;
  workspaceId: string;
}) {
  const history = useExecutionHistory(workspaceId);

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

        {history.isPending ? (
          <p className="dialog-state">Verlauf wird geladen …</p>
        ) : history.isError ? (
          <p className="field-error">Der Verlauf konnte nicht geladen werden.</p>
        ) : history.data.length === 0 ? (
          <p className="dialog-state">Noch keine Requests ausgeführt.</p>
        ) : (
          <div className="execution-history-list">
            {history.data.map((execution) => (
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
