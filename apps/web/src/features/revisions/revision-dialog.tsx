import type { ApiRequest } from "@api-client/contracts";
import { History, RotateCcw } from "lucide-react";

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

const changeTypeLabels = {
  update: "Bearbeitung",
  overwrite: "Überschreiben",
  restore: "Wiederherstellung",
  delete: "Löschen",
} as const;

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
          <h2 id="revision-title">Versionen</h2>
          <p id="revision-description">
            Frühere gespeicherte Fassungen dieses Requests.
          </p>
        </div>
      </DialogHeader>

      <DialogBody>
        {revisions.isPending ? (
          <p className="dialog-state">Versionen werden geladen …</p>
        ) : revisions.isError ? (
          <FieldError>Die Versionen konnten nicht geladen werden.</FieldError>
        ) : revisions.data.length === 0 ? (
          <p className="dialog-state">Noch keine frühere Version vorhanden.</p>
        ) : (
          <div className="revision-list">
            {revisions.data.map((revision) => (
              <article className="revision-row" key={revision.id}>
                <span className={`method ${revision.method.toLowerCase()}`}>
                  {revision.method}
                </span>
                <span className="revision-identity">
                  <strong>
                    Version {revision.version} · {revision.name}
                  </strong>
                  <small>
                    {changeTypeLabels[revision.changeType]} ·{" "}
                    {revision.createdBy.displayName} ·{" "}
                    {new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(revision.createdAt))}
                  </small>
                </span>
                {canRestore ? (
                  <Button
                    disabled={restore.isPending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Version ${revision.version} als neue Version wiederherstellen?`,
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
                    Wiederherstellen
                  </Button>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {restore.error instanceof RequestConflictError ? (
          <FieldError>
            Der Request wurde zwischenzeitlich geändert. Schließe den Dialog
            und lade die aktuelle Version.
          </FieldError>
        ) : restore.isError ? (
          <FieldError>
            Die Version konnte nicht wiederhergestellt werden.
          </FieldError>
        ) : null}
        <p className="security-hint">
          Gespeicherte Header-Werte werden aus Sicherheitsgründen nicht
          wiederhergestellt.
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
