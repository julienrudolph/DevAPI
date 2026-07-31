import type { CollectionSummary, RequestSummary } from "@api-client/contracts";
import { FileUp } from "lucide-react";
import { useMemo, useState } from "react";

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
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="openapi-import-title"
        aria-modal="true"
        className="conflict-dialog openapi-import-dialog"
        role="dialog"
      >
        <div className="team-members-heading">
          <span className="member-avatar">
            <FileUp aria-hidden="true" size={18} />
          </span>
          <div>
            <h2 id="openapi-import-title">API-Definition importieren</h2>
            <p>
              OpenAPI 3.x als JSON/YAML oder Postman Collection 2.x als JSON.
              Externe Referenzen und Dateianhänge werden nicht geladen.
            </p>
          </div>
        </div>
        {!parsed ? (
          <>
            <label className="openapi-source">
              OpenAPI-Dokument
              <textarea
                aria-label="OpenAPI-Dokument"
                autoFocus
                onChange={(event) => setSource(event.target.value)}
                placeholder="Datei hier einfügen oder auswählen …"
                rows={12}
                value={source}
              />
            </label>
            <input
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              aria-label="OpenAPI-Datei auswählen"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) {
                  setError("Die OpenAPI-Datei darf maximal 2 MB groß sein.");
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
              <span>{parsed.requests.length} unterstützte Requests erkannt</span>
            </div>
            <label>
              Ziel-Collection
              <select
                aria-label="Ziel-Collection"
                onChange={(event) => setCollectionId(event.target.value)}
                value={collectionId}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="openapi-operation-list">
              {parsed.requests.map((request) => (
                <label key={request.importId}>
                  <input
                    checked={selectedIds.has(request.importId)}
                    onChange={(event) =>
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        event.target.checked
                          ? next.add(request.importId)
                          : next.delete(request.importId);
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
        <div className="dialog-actions">
          <button className="button secondary" onClick={onClose} type="button">
            Abbrechen
          </button>
          {!parsed ? (
            <button
              className="button primary"
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
                      : "Das Dokument konnte nicht gelesen werden.",
                  );
                }
              }}
              type="button"
            >
              Vorschau erstellen
            </button>
          ) : (
            <button
              className="button primary"
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
                      `${index + 1} von ${selectedRequests.length} Requests …`,
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
                    `${imported.length} Requests wurden importiert. Der Import wurde danach wegen eines Fehlers angehalten.`,
                  );
                  setProgress(undefined);
                }
              }}
              type="button"
            >
              {selectedRequests.length} Requests importieren
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
