import type { CollectionSummary, RequestSummary } from "@api-client/contracts";
import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Dialog,
  DialogFooter,
  Select,
  Textarea,
} from "../../components/ui";
import { useCreateRequest } from "../workspaces/workspace-queries";
import { parseOpenApi, type OpenApiImport } from "./openapi";
import { parsePostmanCollection } from "./postman";

export function OpenApiImportDialog({
  collections,
  onClose,
  onImported,
  workspaceId,
}: {
  collections: CollectionSummary[];
  onClose: () => void;
  onImported: (requests: RequestSummary[]) => void;
  workspaceId: string;
}) {
  const { t } = useTranslation(["import", "common"]);
  const createRequest = useCreateRequest(workspaceId);
  const [source, setSource] = useState("");
  const [parsed, setParsed] = useState<OpenApiImport>();
  const [error, setError] = useState<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [progress, setProgress] = useState<string>();
  const selectedRequests = useMemo(
    () => parsed?.requests.filter(({ importId }) => selectedIds.has(importId)) ?? [],
    [parsed, selectedIds],
  );

  return (
    <Dialog
      className="openapi-import-dialog"
      onClose={onClose}
      titleId="openapi-import-title"
    >
        <div className="team-members-heading">
          <span className="member-avatar">
            <FileUp aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 id="openapi-import-title">{t("title")}</h2>
            <p>{t("description")}</p>
          </div>
        </div>
        {!parsed ? (
          <>
            <label className="openapi-source" htmlFor="openapi-document">
              {t("documentLabel")}
              <Textarea
                aria-label={t("documentLabel")}
                autoFocus
                id="openapi-document"
                onChange={(event) => setSource(event.target.value)}
                placeholder={t("documentPlaceholder")}
                rows={12}
                value={source}
              />
            </label>
            <input
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              aria-label={t("fileSelectLabel")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) {
                  setError(t("fileTooLarge"));
                  return;
                }
                void file.text().then(setSource);
              }}
              type="file"
            />
          </>
        ) : (
          <>
            <div className="openapi-import-summary">
              <strong>{parsed.title}</strong>
              <span>
                {t("requestsDetected", { count: parsed.requests.length })}
              </span>
            </div>
            <label>
              {t("targetCollectionLabel")}
              <Select
                aria-label={t("targetCollectionLabel")}
                onChange={(event) => setCollectionId(event.target.value)}
                value={collectionId}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </Select>
            </label>
            <div className="openapi-operation-list">
              {parsed.requests.map((request) => (
                <label key={request.importId}>
                  <input
                    checked={selectedIds.has(request.importId)}
                    onChange={(event) =>
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) {
                          next.add(request.importId);
                        } else {
                          next.delete(request.importId);
                        }
                        return next;
                      })
                    }
                    type="checkbox"
                  />
                  <span className={`method ${request.method.toLowerCase()}`}>
                    {request.method}
                  </span>
                  <span>
                    <strong>{request.name}</strong>
                    <small>{request.path}</small>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}
        {error ? <p className="field-error">{error}</p> : null}
        {progress ? <p aria-live="polite">{progress}</p> : null}
        <DialogFooter>
          <Button onClick={onClose}>
            {t("actions.cancel", { ns: "common" })}
          </Button>
          {!parsed ? (
            <Button
              disabled={!source.trim()}
              onClick={() => {
                try {
                  let next: OpenApiImport;
                  try {
                    next = parseOpenApi(source);
                  } catch (openApiError) {
                    try {
                      next = parsePostmanCollection(source);
                    } catch {
                      throw openApiError;
                    }
                  }
                  setParsed(next);
                  setSelectedIds(
                    new Set(next.requests.map(({ importId }) => importId)),
                  );
                  setError(undefined);
                } catch (parseError) {
                  setError(
                    parseError instanceof Error
                      ? parseError.message
                      : t("documentUnreadable"),
                  );
                }
              }}
              variant="primary"
            >
              {t("createPreview")}
            </Button>
          ) : (
            <Button
              disabled={
                !collectionId ||
                selectedRequests.length === 0 ||
                createRequest.isPending
              }
              onClick={async () => {
                const imported: RequestSummary[] = [];
                setError(undefined);
                try {
                  for (const [index, request] of selectedRequests.entries()) {
                    setProgress(
                      t("importProgress", {
                        current: index + 1,
                        total: selectedRequests.length,
                      }),
                    );
                    const { importId: _importId, path: _path, ...draft } = request;
                    imported.push(
                      await createRequest.mutateAsync({
                        ...draft,
                        collectionId,
                        folderId: null,
                      }),
                    );
                  }
                  onImported(imported);
                } catch {
                  setError(
                    t("importPartialFailure", { count: imported.length }),
                  );
                  setProgress(undefined);
                }
              }}
              variant="primary"
            >
              {t("importCount", { count: selectedRequests.length })}
            </Button>
          )}
        </DialogFooter>
    </Dialog>
  );
}
