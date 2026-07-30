import { zodResolver } from "@hookform/resolvers/zod";
import {
  type ApiRequest,
  type EnvironmentVariable,
  type RequestConflict,
  type RequestAuth,
  type RequestDraft,
  requestDraftSchema,
} from "@api-client/contracts";
import {
  ClipboardCopy,
  Download,
  History,
  Import,
  Minus,
  Plus,
  Search,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Controller,
  type Control,
  useFieldArray,
  useForm,
  type UseFormRegister,
} from "react-hook-form";

import { RequestConflictError } from "./request-api";
import { formatCurl, parseCurl } from "./curl";
import {
  useExecuteRequest,
  useRequest,
  useUpdateRequest,
} from "./request-queries";
import { RevisionDialog } from "../revisions/revision-dialog";
import {
  findUnresolvedVariables,
  listVariableReferences,
  resolveVariables,
} from "../environments/resolve-variables";

const MonacoEditor = lazy(
  () => import("../../components/editors/monaco-editor"),
);

const HEADER_NAME_SUGGESTIONS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Encoding",
  "Content-Language",
  "Content-Type",
  "ETag",
  "If-Match",
  "If-Modified-Since",
  "If-None-Match",
  "Origin",
  "Prefer",
  "Range",
  "Referer",
  "User-Agent",
  "X-API-Key",
  "X-Correlation-ID",
  "X-Request-ID",
] as const;

interface RequestEditorProps {
  formId?: string;
  requestId: string;
  workspaceId: string;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  variables?: EnvironmentVariable[];
}

export function RequestEditor({
  formId = "request-form",
  requestId,
  workspaceId,
  onDirtyChange,
  readOnly = false,
  variables = [],
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
      formId={formId}
      request={request.data}
      workspaceId={workspaceId}
      onDirtyChange={onDirtyChange}
      readOnly={readOnly}
      variables={variables}
    />
  );
}

function LoadedRequestEditor({
  formId,
  request,
  workspaceId,
  onDirtyChange,
  readOnly,
  variables,
}: {
  formId: string;
  request: ApiRequest;
  workspaceId: string;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly: boolean;
  variables: EnvironmentVariable[];
}) {
  const [activeTab, setActiveTab] = useState("params");
  const [auth, setAuth] = useState<RequestAuth>({ type: "none" });
  const [conflict, setConflict] = useState<RequestConflict>();
  const [baseVersion, setBaseVersion] = useState(request.version);
  const [showingRevisions, setShowingRevisions] = useState(false);
  const [showingCurlImport, setShowingCurlImport] = useState(false);
  const [curlInput, setCurlInput] = useState("");
  const [curlError, setCurlError] = useState<string>();
  const [curlNotice, setCurlNotice] = useState<string>();
  const [responseTab, setResponseTab] = useState<"body" | "headers">("body");
  const [responseSearch, setResponseSearch] = useState("");
  const mutation = useUpdateRequest(workspaceId, request.id);
  const execution = useExecuteRequest(workspaceId);
  const {
    handleSubmit,
    register,
    reset,
    getValues,
    control,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<RequestDraft>({
    resolver: zodResolver(requestDraftSchema),
    defaultValues: toDraft(request),
  });
  const bodyType = watch("body.type");
  const draftUrl = watch("url");
  const draftBody = watch("body.content") ?? "";
  const draftHeaders = watch("headers");
  const draftQueryParams = watch("queryParams");
  const referencedVariables = listVariableReferences(
    [
      draftUrl,
      draftBody,
      ...draftHeaders.flatMap(({ key, value }) => [key, value]),
      ...draftQueryParams.flatMap(({ key, value }) => [key, value]),
    ].join("\n"),
  );
  const unresolvedVariables = findUnresolvedVariables(
    [
      draftUrl,
      draftBody,
      ...draftHeaders.flatMap(({ key, value }) => [key, value]),
      ...draftQueryParams.flatMap(({ key, value }) => [key, value]),
    ],
    variables,
  );

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
        id={formId}
        onSubmit={handleSubmit(async (draft, event) => {
          const intent = (event?.nativeEvent as SubmitEvent | undefined)
            ?.submitter;
          if (
            intent instanceof HTMLButtonElement &&
            intent.value === "execute"
          ) {
            await execution
              .mutateAsync({
                requestId: request.id,
                request: draft,
                auth,
                variables,
              })
              .catch(() => undefined);
            return;
          }
          await save(draft);
        })}
      >
        <div className="editor-state">
          <span aria-live="polite">
            {curlNotice ??
            (mutation.isPending
              ? "Wird gespeichert …"
              : conflict
                ? "Konflikt erkannt"
                : isDirty
                  ? "Ungespeicherte Änderungen"
                  : `Version ${baseVersion} gespeichert`)}
          </span>
          <div className="editor-tools">
            {!readOnly ? (
              <button
                className="revision-link"
                onClick={() => {
                  setCurlError(undefined);
                  setShowingCurlImport(true);
                }}
                type="button"
              >
                <Import aria-hidden="true" size={13} />
                cURL importieren
              </button>
            ) : null}
            <button
              className="revision-link"
              onClick={() => {
                void navigator.clipboard
                  .writeText(formatCurl(getValues()))
                  .then(() => {
                    setCurlNotice("cURL wurde kopiert");
                    window.setTimeout(() => setCurlNotice(undefined), 2_000);
                  })
                  .catch(() =>
                    setCurlNotice("cURL konnte nicht kopiert werden"),
                  );
              }}
              type="button"
            >
              <ClipboardCopy aria-hidden="true" size={13} />
              Als cURL kopieren
            </button>
            <button
              className="revision-link"
              onClick={() => setShowingRevisions(true)}
              type="button"
            >
              <History aria-hidden="true" size={13} />
              Versionen
            </button>
          </div>
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
            list="request-variable-suggestions"
            spellCheck={false}
            {...register("url")}
          />
          <datalist id="request-variable-suggestions">
            {variables.map((variable) => (
              <option
                key={`${variable.scope}:${variable.key}`}
                value={`{{${variable.key}}}`}
              />
            ))}
          </datalist>
        </div>
        {errors.url ? <p className="field-error">{errors.url.message}</p> : null}
        {referencedVariables.length > 0 ? (
          <div className="variable-usage" aria-live="polite">
            <span>
              Variablen:{" "}
              {referencedVariables.map((key) => (
                <code
                  className={
                    unresolvedVariables.includes(key) ? "unresolved" : undefined
                  }
                  key={key}
                >
                  {`{{${key}}}`}
                </code>
              ))}
            </span>
            {unresolvedVariables.length > 0 ? (
              <strong>
                Nicht definiert: {unresolvedVariables.join(", ")}
              </strong>
            ) : (
              <span className="resolved-url">
                Vorschau: {resolveVariables(draftUrl, variables)}
              </span>
            )}
          </div>
        ) : null}

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
              control={control}
              field="queryParams"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "headers" ? (
            <KeyValueTable
              emptyLabel="Header hinzufügen"
              control={control}
              field="headers"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "body" ? (
            <div className="body-editor">
              <label>
                Body-Typ
                <select
                  disabled={readOnly}
                  onChange={(event) => {
                    const type = event.target.value as
                      | "none"
                      | "json"
                      | "text";
                    setValue(
                      "body",
                      type === "none"
                        ? { type: "none" }
                        : {
                            type,
                            content: type === "json" ? "{}" : "",
                          },
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                  value={bodyType}
                >
                  <option value="none">Kein Body</option>
                  <option value="json">JSON</option>
                  <option value="text">Text</option>
                </select>
              </label>
              {bodyType !== "none" ? (
                <Controller
                  control={control}
                  name="body.content"
                  render={({ field }) => (
                    <Suspense
                      fallback={
                        <div className="editor-loading">
                          Body-Editor wird geladen …
                        </div>
                      }
                    >
                      <MonacoEditor
                        height="280px"
                        language={bodyType === "json" ? "json" : "plaintext"}
                        onChange={(value) => field.onChange(value ?? "")}
                        options={{
                          automaticLayout: true,
                          minimap: { enabled: false },
                          readOnly,
                          scrollBeyondLastLine: false,
                          tabSize: 2,
                        }}
                        theme="vs"
                        value={field.value ?? ""}
                      />
                    </Suspense>
                  )}
                />
              ) : (
                <div className="empty-panel">
                  Dieser Request sendet keinen Body.
                </div>
              )}
              {errors.body?.message ? (
                <p className="field-error">{errors.body.message}</p>
              ) : null}
              {errors.body && "content" in errors.body &&
              errors.body.content?.message ? (
                <p className="field-error">
                  {errors.body.content.message}
                </p>
              ) : null}
            </div>
          ) : null}
          {activeTab === "auth" ? (
            <div className="auth-editor">
              <label>
                Authentifizierung
                <select
                  onChange={(event) => {
                    const type = event.target.value;
                    setAuth(
                      type === "bearer"
                        ? { type: "bearer", token: "" }
                        : type === "basic"
                          ? { type: "basic", username: "", password: "" }
                          : { type: "none" },
                    );
                  }}
                  value={auth.type}
                >
                  <option value="none">Keine</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </label>
              {auth.type === "bearer" ? (
                <label>
                  Token
                  <input
                    aria-label="Bearer Token"
                    autoComplete="off"
                    onChange={(event) =>
                      setAuth({ type: "bearer", token: event.target.value })
                    }
                    type="password"
                    value={auth.token}
                  />
                </label>
              ) : null}
              {auth.type === "basic" ? (
                <>
                  <label>
                    Benutzername
                    <input
                      aria-label="Basic Benutzername"
                      autoComplete="username"
                      onChange={(event) =>
                        setAuth({ ...auth, username: event.target.value })
                      }
                      value={auth.username}
                    />
                  </label>
                  <label>
                    Passwort
                    <input
                      aria-label="Basic Passwort"
                      autoComplete="current-password"
                      onChange={(event) =>
                        setAuth({ ...auth, password: event.target.value })
                      }
                      type="password"
                      value={auth.password}
                    />
                  </label>
                </>
              ) : null}
              <p className="security-hint">
                Zugangsdaten gelten nur für diesen geöffneten Editor. Sie
                werden nicht im Workspace, in Revisionen oder im Browser-Cache
                gespeichert.
              </p>
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
              <div className="response-toolbar">
                <div aria-label="Response-Ansicht" className="response-tabs">
                  <button
                    aria-selected={responseTab === "body"}
                    className={responseTab === "body" ? "active" : undefined}
                    onClick={() => setResponseTab("body")}
                    role="tab"
                    type="button"
                  >
                    Body
                  </button>
                  <button
                    aria-selected={responseTab === "headers"}
                    className={
                      responseTab === "headers" ? "active" : undefined
                    }
                    onClick={() => setResponseTab("headers")}
                    role="tab"
                    type="button"
                  >
                    Header ({Object.keys(execution.data.headers).length})
                  </button>
                </div>
                <div className="response-actions">
                  <label className="response-search">
                    <Search aria-hidden="true" size={14} />
                    <span className="sr-only">Response durchsuchen</span>
                    <input
                      aria-label="Response durchsuchen"
                      onChange={(event) => setResponseSearch(event.target.value)}
                      placeholder="Suchen"
                      type="search"
                      value={responseSearch}
                    />
                    {responseSearch ? (
                      <span>
                        {countMatches(
                          responseTab === "body"
                            ? formatResponseBody(execution.data.body)
                            : formatResponseHeaders(execution.data.headers),
                          responseSearch,
                        )}{" "}
                        Treffer
                      </span>
                    ) : null}
                  </label>
                  <button
                    className="icon-button"
                    onClick={() =>
                      void navigator.clipboard.writeText(
                        responseTab === "body"
                          ? formatResponseBody(execution.data.body)
                          : formatResponseHeaders(execution.data.headers),
                      )
                    }
                    title="Aktuelle Response-Ansicht kopieren"
                    type="button"
                  >
                    <ClipboardCopy aria-hidden="true" size={15} />
                    <span className="sr-only">Response kopieren</span>
                  </button>
                  <button
                    className="icon-button"
                    onClick={() =>
                      downloadResponseBody(
                        execution.data.body,
                        execution.data.headers,
                      )
                    }
                    title="Response-Body herunterladen"
                    type="button"
                  >
                    <Download aria-hidden="true" size={15} />
                    <span className="sr-only">
                      Response-Body herunterladen
                    </span>
                  </button>
                </div>
              </div>
              <div className="response-content" role="tabpanel">
                <pre>
                  {responseTab === "body"
                    ? formatResponseBody(execution.data.body)
                    : formatResponseHeaders(execution.data.headers)}
                </pre>
              </div>
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
      {showingRevisions ? (
        <RevisionDialog
          canRestore={!readOnly}
          currentVersion={baseVersion}
          onClose={() => setShowingRevisions(false)}
          onRestored={(restored) => {
            reset(toDraft(restored));
            setBaseVersion(restored.version);
            setConflict(undefined);
            setShowingRevisions(false);
          }}
          requestId={request.id}
          workspaceId={workspaceId}
        />
      ) : null}
      {showingCurlImport ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="curl-import-title"
            aria-modal="true"
            className="conflict-dialog curl-import-dialog"
            role="dialog"
          >
            <h2 id="curl-import-title">cURL importieren</h2>
            <p>
              Das Kommando wird nur lokal ausgewertet und nicht ausgeführt.
              Vorhandene Request-Felder werden erst nach deiner Bestätigung
              ersetzt.
            </p>
            <textarea
              aria-label="cURL-Kommando"
              autoFocus
              onChange={(event) => {
                setCurlInput(event.target.value);
                setCurlError(undefined);
              }}
              placeholder="curl -X POST 'https://api.example.com/…'"
              rows={9}
              value={curlInput}
            />
            {curlError ? (
              <p className="field-error" role="alert">
                {curlError}
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setShowingCurlImport(false)}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                onClick={() => {
                  try {
                    const imported = parseCurl(curlInput);
                    setValue("method", imported.method, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("url", imported.url, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("queryParams", imported.queryParams, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("headers", imported.headers, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setValue("body", imported.body, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    setShowingCurlImport(false);
                    setCurlInput("");
                    setCurlError(undefined);
                    setCurlNotice("cURL wurde als Entwurf übernommen");
                  } catch (error) {
                    setCurlError(
                      error instanceof Error
                        ? error.message
                        : "Das cURL-Kommando ist ungültig.",
                    );
                  }
                }}
                type="button"
              >
                Als Entwurf übernehmen
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

function formatResponseHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
}

export function countMatches(value: string, search: string): number {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  const haystack = value.toLocaleLowerCase();
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

function downloadResponseBody(
  body: string,
  headers: Record<string, string>,
): void {
  const contentTypeEntry = Object.entries(headers).find(
    ([name]) => name.toLocaleLowerCase() === "content-type",
  );
  const contentType = contentTypeEntry?.[1] ?? "text/plain;charset=utf-8";
  const extension = contentType.includes("json")
    ? "json"
    : contentType.includes("html")
      ? "html"
      : contentType.includes("xml")
        ? "xml"
        : "txt";
  const url = URL.createObjectURL(new Blob([body], { type: contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `response.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
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

function KeyValueTable({
  emptyLabel,
  field,
  control,
  register,
  readOnly,
}: {
  emptyLabel: string;
  field: "headers" | "queryParams";
  control: Control<RequestDraft>;
  register: UseFormRegister<RequestDraft>;
  readOnly: boolean;
}) {
  const { append, fields, remove } = useFieldArray({
    control,
    keyName: "fieldKey",
    name: field,
  });

  return (
    <div className="key-value-table">
      {field === "headers" ? (
        <datalist id="request-header-name-suggestions">
          {HEADER_NAME_SUGGESTIONS.map((header) => (
            <option key={header} value={header} />
          ))}
        </datalist>
      ) : null}
      <div className="table-head">
        <span />
        <span>Schlüssel</span>
        <span>Wert</span>
        <span />
      </div>
      {fields.map((entry, index) => (
        <div className="table-row" key={entry.fieldKey}>
          <input
            aria-label="Eintrag aktivieren"
            disabled={readOnly}
            type="checkbox"
            {...register(`${field}.${index}.enabled`)}
          />
          <input
            aria-label="Schlüssel"
            autoComplete="off"
            disabled={readOnly}
            list={
              field === "headers"
                ? "request-header-name-suggestions"
                : undefined
            }
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
          {!readOnly ? (
            <button
              aria-label="Eintrag entfernen"
              className="icon-button compact"
              onClick={() => remove(index)}
              type="button"
            >
              <Minus aria-hidden="true" size={14} />
            </button>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <button
          className="add-row"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              key: "",
              value: "",
              enabled: true,
            })
          }
          type="button"
        >
          <Plus aria-hidden="true" size={14} /> {emptyLabel}
        </button>
      ) : null}
    </div>
  );
}
