import type { ApiRequest } from "@api-client/contracts";
import { History, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FieldError,
} from "../../components/ui";
import { RequestConflictError } from "../requests/request-api";
import {
  useRequestRevisions,
  useRestoreRequestRevision,
} from "./revision-queries";

const dateFormatLocales: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
};

export function RevisionDialog({
  canRestore,
  currentVersion,
  onClose,
  onRestored,
  requestId,
  workspaceId,
}: {
  canRestore: boolean;
  currentVersion: number;
  onClose: () => void;
  onRestored: (request: ApiRequest) => void;
  requestId: string;
  workspaceId: string;
}) {
  const { i18n, t } = useTranslation(["revisions", "common"]);
  const revisions = useRequestRevisions(requestId);
  const restore = useRestoreRequestRevision(workspaceId, requestId);

  return (
    <Dialog
      className="revision-dialog"
      descriptionId="revision-description"
      onClose={onClose}
      titleId="revision-title"
    >
      <DialogHeader>
        <span className="member-avatar">
          <History aria-hidden="true" size={18} />
        </span>
        <div>
          <h2 id="revision-title">{t("title")}</h2>
          <p id="revision-description">{t("description")}</p>
        </div>
      </DialogHeader>

      <DialogBody>
        {revisions.isPending ? (
          <p className="dialog-state">{t("loading")}</p>
        ) : revisions.isError ? (
          <FieldError>{t("loadError")}</FieldError>
        ) : revisions.data.length === 0 ? (
          <p className="dialog-state">{t("empty")}</p>
        ) : (
          <div className="revision-list">
            {revisions.data.map((revision) => (
              <article className="revision-row" key={revision.id}>
                <span className={`method ${revision.method.toLowerCase()}`}>
                  {revision.method}
                </span>
                <span className="revision-identity">
                  <strong>
                    {t("versionLabel", {
                      version: revision.version,
                      name: revision.name,
                    })}
                  </strong>
                  <small>
                    {t(`changeType.${revision.changeType}`)} ·{" "}
                    {revision.createdBy.displayName} ·{" "}
                    {new Intl.DateTimeFormat(
                      dateFormatLocales[i18n.language] ?? "en-US",
                      { dateStyle: "short", timeStyle: "short" },
                    ).format(new Date(revision.createdAt))}
                  </small>
                </span>
                {canRestore ? (
                  <Button
                    disabled={restore.isPending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          t("restoreConfirm", { version: revision.version }),
                        )
                      ) {
                        return;
                      }
                      void restore
                        .mutateAsync({
                          revisionId: revision.id,
                          expectedVersion: currentVersion,
                        })
                        .then(onRestored)
                        .catch(() => undefined);
                    }}
                    type="button"
                  >
                    <RotateCcw aria-hidden="true" size={14} />
                    {t("restore")}
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {restore.error instanceof RequestConflictError ? (
          <FieldError>{t("conflictError")}</FieldError>
        ) : restore.isError ? (
          <FieldError>{t("restoreError")}</FieldError>
        ) : null}
        <p className="security-hint">{t("headerSecurityHint")}</p>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="primary">
          {t("actions.close", { ns: "common" })}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
