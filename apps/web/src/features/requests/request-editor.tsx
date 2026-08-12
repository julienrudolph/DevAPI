import { zodResolver } from "@hookform/resolvers/zod";
import { Tab, TabList } from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  ArrowImport20Regular,
  Copy20Regular,
  History20Regular,
  Search20Regular,
  Subtract20Regular,
} from "@fluentui/react-icons";
import {
  type ApiRequest,
  type EnvironmentVariable,
  type RequestConflict,
  type RequestAuth,
  type RequestDraft,
  requestDraftSchema,
} from "@api-client/contracts";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Controller,
  type Control,
  useFieldArray,
  useForm,
  type UseFormRegister,
} from "react-hook-form";

import {
  Button,
  Dialog,
  DialogFooter,
  IconButton,
  Textarea,
  Tooltip,
} from "../../components/ui";
import { RequestConflictError } from "./request-api";
import { RequestExecutionError } from "./request-execution-api";
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

type RequestConfigurationTab = "params" | "headers" | "body" | "auth";

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
        <Button onClick={() => request.refetch()}>
          Erneut versuchen
        </Button>
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
  const [activeTab, setActiveTab] =
    useState<RequestConfigurationTab>("params");
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
              <Button
                className="revision-link"
                onClick={() => {
                  setCurlError(undefined);
                  setShowingCurlImport(true);
                }}
                size="small"
                variant="ghost"
              >
                <ArrowImport20Regular aria-hidden="true" />
                cURL importieren
              </Button>
            ) : null}
            <Button
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
              size="small"
              variant="ghost"
            >
              <Copy20Regular aria-hidden="true" />
              Als cURL kopieren
            </Button>
            <Button
              className="revision-link"
              onClick={() => setShowingRevisions(true)}
              size="small"
              variant="ghost"
            >
              <History20Regular aria-hidden="true" />
              Versionen
            </Button>
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

        <TabList
          aria-label="Request-Konfiguration"
          className="fluent-tabs"
          onTabSelect={(_, data) =>
            setActiveTab(data.value as RequestConfigurationTab)
          }
          selectedValue={activeTab}
        >
          {([
            ["params", "Parameter"],
            ["headers", "Header"],
            ["body", "Body"],
            ["auth", "Authentifizierung"],
          ] as const).map(([id, label]) => (
            <Tab key={id} value={id}>
              {label}
            </Tab>
          ))}
        </TabList>

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
                      | "text"
                      | "form-urlencoded"
                      | "multipart";
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
                  <option value="form-urlencoded">Form URL-encoded</option>
                  <option value="multipart">Form-Data (nur Textfelder)</option>
                </select>
              </label>
              {bodyType === "form-urlencoded" || bodyType === "multipart" ? (
                <p className="security-hint">
                  Ein Feld pro Zeile im Format <code>name=wert</code>. Dateien
                  werden in dieser Version nicht unterstützt.
                </p>
              ) : null}
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
              <strong>Request konnte nicht ausgeführt werden</strong>
              <p>{execution.error.message}</p>
              {execution.error instanceof RequestExecutionError ? (
                <code>Fehlercode: {execution.error.code}</code>
              ) : null}
            </div>
          ) : execution.data ? (
            <div className="response-result">
              {execution.data.status >= 400 ||
              isHtmlResponse(execution.data.headers, execution.data.body) ? (
                <div
                  className={`response-notice ${
                    execution.data.status >= 400 ? "error" : ""
                  }`}
                  role={execution.data.status >= 400 ? "alert" : "status"}
                >
                  <strong>
                    {execution.data.status >= 400
                      ? `HTTP ${execution.data.status}: Die Ziel-API meldet einen Fehler`
                      : "HTML-Antwort empfangen"}
                  </strong>
                  <p>{describeHttpStatus(execution.data.status)}</p>
                  {isHtmlResponse(
                    execution.data.headers,
                    execution.data.body,
                  ) ? (
                    <p>
                      Der Server hat HTML zurückgegeben. Das ist häufig eine
                      Fehlerseite eines Webservers, Reverse Proxys oder einer
                      falsch adressierten Route. Der HTML-Quelltext wird unten
                      sicher als Text angezeigt und nicht ausgeführt.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="response-toolbar">
                <TabList
                  aria-label="Response-Ansicht"
                  className="response-tabs"
                  onTabSelect={(_, data) =>
                    setResponseTab(data.value as "body" | "headers")
                  }
                  selectedValue={responseTab}
                  size="small"
                >
                  <Tab value="body">
                    Body
                  </Tab>
                  <Tab value="headers">
                    Header ({Object.keys(execution.data.headers).length})
                  </Tab>
                </TabList>
                <div className="response-actions">
                  <label className="response-search">
                    <Search20Regular aria-hidden="true" />
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
                  <Tooltip
                    content="Aktuelle Response-Ansicht kopieren"
                    relationship="description"
                  >
                    <IconButton
                      aria-label="Response kopieren"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          responseTab === "body"
                            ? formatResponseBody(execution.data.body)
                            : formatResponseHeaders(execution.data.headers),
                        )
                      }
                    >
                      <Copy20Regular aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    content="Response-Body herunterladen"
                    relationship="description"
                  >
                    <IconButton
                      aria-label="Response-Body herunterladen"
                      onClick={() =>
                        downloadResponseBody(
                          execution.data.body,
                          execution.data.headers,
                        )
                      }
                    >
                      <ArrowDownload20Regular aria-hidden="true" />
                    </IconButton>
                  </Tooltip>
                </div>
              </div>
              <div className="response-content" role="tabpanel">
                {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex --
                    Content can overflow and scroll; tabIndex keeps it reachable
                    by keyboard per WCAG 2.1.1 (scrollable-region-focusable). */}
                <pre aria-label="Response-Inhalt" role="region" tabIndex={0}>
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
        <Dialog
          onClose={() => setConflict(undefined)}
          titleId="conflict-title"
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
            <DialogFooter>
              <Button
                onClick={() => {
                  reset(toDraft(conflict.current));
                  setBaseVersion(conflict.currentVersion);
                  setConflict(undefined);
                }}
              >
                Team-Version übernehmen
              </Button>
              <Button
                onClick={() => setConflict(undefined)}
              >
                Weiter bearbeiten
              </Button>
              <Button
                disabled={mutation.isPending}
                onClick={() => void save(getValues(), true)}
                variant="primary"
              >
                Meine Version speichern
              </Button>
            </DialogFooter>
        </Dialog>
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
        <Dialog
          className="curl-import-dialog"
          onClose={() => setShowingCurlImport(false)}
          titleId="curl-import-title"
        >
            <h2 id="curl-import-title">cURL importieren</h2>
            <p>
              Das Kommando wird nur lokal ausgewertet und nicht ausgeführt.
              Vorhandene Request-Felder werden erst nach deiner Bestätigung
              ersetzt.
            </p>
            <Textarea
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
            <DialogFooter>
              <Button
                onClick={() => setShowingCurlImport(false)}
              >
                Abbrechen
              </Button>
              <Button
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
                variant="primary"
              >
                Als Entwurf übernehmen
              </Button>
            </DialogFooter>
        </Dialog>
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

export function isHtmlResponse(
  headers: Record<string, string>,
  body: string,
): boolean {
  const contentType = Object.entries(headers).find(
    ([name]) => name.toLocaleLowerCase() === "content-type",
  )?.[1];
  if (contentType?.toLocaleLowerCase().includes("text/html")) return true;
  return /^\s*(?:<!doctype\s+html|<html[\s>])/i.test(body);
}

export function describeHttpStatus(status: number): string {
  const descriptions: Record<number, string> = {
    400: "Die Ziel-API lehnt den Request als ungültig ab. Prüfe URL, Parameter, Header und Body.",
    401: "Die Ziel-API verlangt eine gültige Authentifizierung. Prüfe Authorization-Header oder den Authentifizierungs-Tab.",
    403: "Die Ziel-API hat den Request verstanden, erlaubt deinem Benutzer oder Token den Zugriff aber nicht.",
    404: "Die angeforderte Route wurde auf dem Zielserver nicht gefunden. Prüfe insbesondere Pfad und Basis-URL.",
    405: "Die verwendete HTTP-Methode ist für diese Route nicht erlaubt.",
    408: "Die Ziel-API hat den Request wegen einer Zeitüberschreitung beendet.",
    409: "Die Ziel-API meldet einen Konflikt mit dem aktuellen Zustand der Ressource.",
    413: "Der gesendete Request ist für die Ziel-API zu groß.",
    415: "Die Ziel-API unterstützt den gesendeten Content-Type nicht.",
    422: "Der Request ist syntaktisch gültig, enthält aber fachlich ungültige Daten.",
    429: "Die Ziel-API hat ihr Anfragelimit erreicht. Warte kurz und versuche es erneut.",
    500: "Auf der Ziel-API ist ein interner Fehler aufgetreten.",
    502: "Ein Gateway oder Reverse Proxy hat vom nachgelagerten Zielserver keine gültige Antwort erhalten.",
    503: "Die Ziel-API ist momentan nicht verfügbar oder wird gewartet.",
    504: "Ein Gateway oder Reverse Proxy hat beim Warten auf den Zielserver das Zeitlimit erreicht.",
  };
  if (descriptions[status]) return descriptions[status];
  if (status >= 500) {
    return "Die Ziel-API oder ein vorgeschalteter Server hat einen internen Fehler gemeldet.";
  }
  if (status >= 400) {
    return "Die Ziel-API hat den Request abgelehnt. Prüfe Response-Body und Header für weitere Details.";
  }
  if (status >= 300) {
    return "Die Ziel-API meldet eine Weiterleitung. Ohne gültiges Location-Ziel kann sie nicht automatisch verfolgt werden.";
  }
  if (status >= 200) {
    return "Die Ziel-API hat den Request erfolgreich beantwortet.";
  }
  return "Die Ziel-API hat eine informative Zwischenantwort geliefert.";
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
            <IconButton
              aria-label="Eintrag entfernen"
              onClick={() => remove(index)}
              size="compact"
            >
              <Subtract20Regular aria-hidden="true" />
            </IconButton>
          ) : null}
        </div>
      ))}
      {!readOnly ? (
        <Button
          className="add-row"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              key: "",
              value: "",
              enabled: true,
            })
          }
          size="small"
          variant="ghost"
        >
          <Add20Regular aria-hidden="true" /> {emptyLabel}
        </Button>
      ) : null}
    </div>
  );
}
