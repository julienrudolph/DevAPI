import { Clock3, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FieldError,
  IconButton,
  Input,
  Select,
} from "../../components/ui";
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
    <Dialog
      className="execution-history-dialog"
      descriptionId="execution-history-description"
      onClose={onClose}
      titleId="execution-history-title"
    >
      <DialogHeader>
        <span className="member-avatar">
          <Clock3 aria-hidden="true" size={18} />
        </span>
        <div>
          <h2 id="execution-history-title">Request-Verlauf</h2>
          <p id="execution-history-description">
            Maximal 100 Einträge aus den letzten 30 Tagen.
          </p>
        </div>
      </DialogHeader>

      <DialogBody>
        {!history.isPending && !history.isError && history.data.length > 0 ? (
          <div className="history-filters">
            <div className="history-search-field">
              <Search aria-hidden="true" size={15} />
              <span className="sr-only">Verlauf durchsuchen</span>
              <Input
                aria-label="Verlauf durchsuchen"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Request, Methode, Status, Person"
                type="search"
                value={query}
              />
            </div>
            <Select
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
            </Select>
          </div>
        ) : null}

        {history.isPending ? (
          <p className="dialog-state">Verlauf wird geladen …</p>
        ) : history.isError ? (
          <FieldError>Der Verlauf konnte nicht geladen werden.</FieldError>
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
                  <IconButton
                    aria-label={`${execution.requestName} öffnen`}
                    onClick={() => {
                      onOpenRequest(execution.requestId);
                      onClose();
                    }}
                    title="Request in einem Tab öffnen"
                    size="compact"
                  >
                    <ExternalLink aria-hidden="true" size={14} />
                  </IconButton>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <p className="security-hint">
          URL, Header, Zugangsdaten sowie Request- und Response-Inhalte werden
          nicht im Verlauf gespeichert.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="primary">
          Schließen
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
