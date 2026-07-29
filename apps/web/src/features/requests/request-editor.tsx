import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ApiRequest,
  type RequestConflict,
  type RequestDraft,
  requestDraftSchema,
} from "@api-client/contracts";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { RequestConflictError } from "./request-api";
import {
  useExecuteRequest,
  useRequest,
  useUpdateRequest,
} from "./request-queries";

interface RequestEditorProps {
  requestId: string;
  workspaceId: string;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
}

export function RequestEditor({
  requestId,
  workspaceId,
  onDirtyChange,
  readOnly = false,
}: RequestEditorProps) {
  const request = useRequest(requestId);

  if (request.isPending) {
    return <div className="centered-state">Request wird geladen …</div>;
  }
  if (request.isError) {
    return (
      <div className="centered-state">
        <p>Der Request konnte nicht geladen werden.</p>
        <button className="button secondary" onClick={() => request.refetch()}>
          Erneut versuchen
        </button>
      </div>
    );
  }
  return (
    <LoadedRequestEditor
      key={request.data.id}
      request={request.data}
      workspaceId={workspaceId}
      onDirtyChange={onDirtyChange}
      readOnly={readOnly}
    />
  );
}

function LoadedRequestEditor({
  request,
  workspaceId,
  onDirtyChange,
  readOnly,
}: {
  request: ApiRequest;
  workspaceId: string;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly: boolean;
}) {
  const [activeTab, setActiveTab] = useState("params");
  const [conflict, setConflict] = useState<RequestConflict>();
  const [baseVersion, setBaseVersion] = useState(request.version);
  const mutation = useUpdateRequest(workspaceId, request.id);
  const execution = useExecuteRequest();
  const {
    handleSubmit,
    register,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<RequestDraft>({
    resolver: zodResolver(requestDraftSchema),
    defaultValues: toDraft(request),
  });

  useEffect(() => {
    if (!isDirty && request.version !== baseVersion) {
      reset(toDraft(request));
      setBaseVersion(request.version);
    }
  }, [baseVersion, isDirty, request, reset]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, onDirtyChange]);

  async function save(draft: RequestDraft, overwrite = false) {
    try {
      const updated = await mutation.mutateAsync({
        ...draft,
        expectedVersion: overwrite
          ? conflict?.currentVersion ?? baseVersion
          : baseVersion,
        overwrite: overwrite || undefined,
      });
      reset(toDraft(updated));
      setBaseVersion(updated.version);
      setConflict(undefined);
    } catch (error) {
      if (error instanceof RequestConflictError) {
        setBaseVersion(error.conflict.currentVersion);
        setConflict(error.conflict);
      }
    }
  }

  return (
    <>
      <form
        className="editor"
        id="request-form"
        onSubmit={handleSubmit(async (draft, event) => {
          const intent = (event?.nativeEvent as SubmitEvent | undefined)
            ?.submitter;
          if (
            intent instanceof HTMLButtonElement &&
            intent.value === "execute"
          ) {
            await execution.mutateAsync(draft).catch(() => undefined);
            return;
          }
          await save(draft);
        })}
      >
        <div className="editor-state" aria-live="polite">
          {mutation.isPending
            ? "Wird gespeichert …"
            : conflict
              ? "Konflikt erkannt"
              : isDirty
                ? "Ungespeicherte Änderungen"
                : `Version ${baseVersion} gespeichert`}
        </div>
        <div className="url-bar">
          <select
            aria-label="HTTP-Methode"
            disabled={readOnly}
            {...register("method")}
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input
            aria-label="Request-URL"
            autoComplete="off"
            disabled={readOnly}
            spellCheck={false}
            {...register("url")}
          />
        </div>
        {errors.url ? <p className="field-error">{errors.url.message}</p> : null}

        <div className="tabs" role="tablist" aria-label="Request-Konfiguration">
          {([
            ["params", "Parameter"],
            ["headers", "Header"],
            ["body", "Body"],
            ["auth", "Authentifizierung"],
          ] as const).map(([id, label]) => (
            <button
              aria-selected={activeTab === id}
              className={activeTab === id ? "active" : ""}
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="editor-panel">
          {activeTab === "params" ? (
            <KeyValueTable
              emptyLabel="Query-Parameter hinzufügen"
              entries={request.queryParams}
              field="queryParams"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "headers" ? (
            <KeyValueTable
              emptyLabel="Header hinzufügen"
              entries={request.headers}
              field="headers"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "body" ? (
            <div className="empty-panel">
              Body-Bearbeitung wird im nächsten Editor-Schritt ergänzt.
            </div>
          ) : null}
          {activeTab === "auth" ? (
            <div className="empty-panel">
              Keine Authentifizierung ausgewählt.
            </div>
          ) : null}
        </div>

        <section className="response-panel" aria-live="polite">
          <div className="response-heading">
            <h2>Response</h2>
            {execution.data ? (
              <div className="response-meta">
                <span
                  className={
                    execution.data.status < 400 ? "status-ok" : "status-error"
                  }
                >
                  {execution.data.status} {execution.data.statusText}
                </span>
                <span>{execution.data.durationMs} ms</span>
              </div>
            ) : null}
          </div>
          {execution.isPending ? (
            <div className="response-empty">Request wird ausgeführt …</div>
          ) : execution.isError ? (
            <div className="response-error" role="alert">
              {execution.error.message}
            </div>
          ) : execution.data ? (
            <div className="response-result">
              <details>
                <summary>Response-Header</summary>
                <pre>
                  {Object.entries(execution.data.headers)
                    .map(([name, value]) => `${name}: ${value}`)
                    .join("\n")}
                </pre>
              </details>
              <pre>{formatResponseBody(execution.data.body)}</pre>
            </div>
          ) : (
            <div className="response-empty">
              Sende den Request, um die Response hier zu sehen.
            </div>
          )}
        </section>
      </form>

      {conflict ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="conflict-title"
            aria-modal="true"
            className="conflict-dialog"
            role="dialog"
          >
            <h2 id="conflict-title">Request wurde zwischenzeitlich geändert</h2>
            <p>
              Die Team-Version ist jetzt Version {conflict.currentVersion}.
              Dein lokaler Entwurf bleibt erhalten.
            </p>
            <dl className="conflict-comparison">
              <div>
                <dt>Deine URL</dt>
                <dd>{getValues("url")}</dd>
              </div>
              <div>
                <dt>Team-URL</dt>
                <dd>{conflict.current.url}</dd>
              </div>
            </dl>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => {
                  reset(toDraft(conflict.current));
                  setBaseVersion(conflict.currentVersion);
                  setConflict(undefined);
                }}
                type="button"
              >
                Team-Version übernehmen
              </button>
              <button
                className="button secondary"
                onClick={() => setConflict(undefined)}
                type="button"
              >
                Weiter bearbeiten
              </button>
              <button
                className="button primary"
                disabled={mutation.isPending}
                onClick={() => void save(getValues(), true)}
                type="button"
              >
                Meine Version speichern
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function formatResponseBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function toDraft(request: ApiRequest): RequestDraft {
  return {
    name: request.name,
    method: request.method,
    url: request.url,
    queryParams: request.queryParams,
    headers: request.headers,
    body: request.body,
  };
}

type Register = ReturnType<typeof useForm<RequestDraft>>["register"];

function KeyValueTable({
  emptyLabel,
  entries,
  field,
  register,
  readOnly,
}: {
  emptyLabel: string;
  entries: RequestDraft["headers"];
  field: "headers" | "queryParams";
  register: Register;
  readOnly: boolean;
}) {
  return (
    <div className="key-value-table">
      <div className="table-head">
        <span />
        <span>Schlüssel</span>
        <span>Wert</span>
      </div>
      {entries.map((entry, index) => (
        <div className="table-row" key={entry.id}>
          <input
            aria-label="Eintrag aktivieren"
            disabled={readOnly}
            type="checkbox"
            {...register(`${field}.${index}.enabled`)}
          />
          <input
            aria-label="Schlüssel"
            disabled={readOnly}
            placeholder="key"
            {...register(`${field}.${index}.key`)}
          />
          <input
            aria-label="Wert"
            disabled={readOnly}
            placeholder="value"
            {...register(`${field}.${index}.value`)}
          />
          <input type="hidden" {...register(`${field}.${index}.id`)} />
        </div>
      ))}
      <button className="add-row" type="button">
        + {emptyLabel}
      </button>
    </div>
  );
}
