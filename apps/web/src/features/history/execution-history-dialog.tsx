import { Clock3, ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

const dateFormatLocales: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
};

export function ExecutionHistoryDialog({
  onClose,
  onOpenRequest,
  workspaceId,
}: {
  onClose: () => void;
  onOpenRequest?: (requestId: string) => void;
  workspaceId: string;
}) {
  const { i18n, t } = useTranslation(["history", "common"]);
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
          <h2 id="execution-history-title">{t("title")}</h2>
          <p id="execution-history-description">{t("description")}</p>
        </div>
      </DialogHeader>

      <DialogBody>
        {!history.isPending && !history.isError && history.data.length > 0 ? (
          <div className="history-filters">
            <div className="history-search-field">
              <Search aria-hidden="true" size={15} />
              <span className="sr-only">{t("searchLabel")}</span>
              <Input
                aria-label={t("searchLabel")}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                type="search"
                value={query}
              />
            </div>
            <Select
              aria-label={t("statusFilterLabel")}
              onChange={(event) =>
                setStatus(
                  event.target.value as "all" | "successful" | "failed",
                )
              }
              value={status}
            >
              <option value="all">{t("statusAll")}</option>
              <option value="successful">{t("statusSuccessful")}</option>
              <option value="failed">{t("statusFailed")}</option>
            </Select>
          </div>
        ) : null}

        {history.isPending ? (
          <p className="dialog-state">{t("loading")}</p>
        ) : history.isError ? (
          <FieldError>{t("loadError")}</FieldError>
        ) : history.data.length === 0 ? (
          <p className="dialog-state">{t("empty")}</p>
        ) : filteredHistory.length === 0 ? (
          <p className="dialog-state">{t("noMatches")}</p>
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
                    {new Intl.DateTimeFormat(
                      dateFormatLocales[i18n.language] ?? "en-US",
                      { dateStyle: "short", timeStyle: "short" },
                    ).format(new Date(execution.executedAt))}
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
                    aria-label={t("openRequest", {
                      name: execution.requestName,
                    })}
                    onClick={() => {
                      onOpenRequest(execution.requestId);
                      onClose();
                    }}
                    title={t("openRequestTitle")}
                    size="compact"
                  >
                    <ExternalLink aria-hidden="true" size={14} />
                  </IconButton>
                ) : null}
              </article>
            ))}
          </div>
        )}

        <p className="security-hint">{t("securityHint")}</p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="primary">
          {t("actions.close", { ns: "common" })}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
