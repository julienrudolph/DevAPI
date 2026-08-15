import { zodResolver } from "@hookform/resolvers/zod";
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Tab,
  TabList,
} from "@fluentui/react-components";
import {
  Add20Regular,
  ArrowDownload20Regular,
  ArrowImport20Regular,
  ChevronDown20Regular,
  Copy20Regular,
  History20Regular,
  Search20Regular,
  Subtract20Regular,
} from "@fluentui/react-icons";
import {
  type ApiRequest,
  type Assertion,
  type EnvironmentVariable,
  type RequestConflict,
  type RequestAuth,
  type RequestDraft,
  requestDraftSchema,
} from "@api-client/contracts";
import { Variable } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  Controller,
  type Control,
  useFieldArray,
  useForm,
  type UseFormRegister,
} from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Button,
  Dialog,
  DialogFooter,
  IconButton,
  Input,
  Select,
  Textarea,
  Tooltip,
} from "../../components/ui";
import i18n from "../../lib/i18n";
import { RequestConflictError } from "./request-api";
import {
  RequestExecutionError,
  type ExecutionMode,
} from "./request-execution-api";
import { evaluateAssertions } from "./assertions";
import { formatCodeSnippet, snippetLanguages } from "./code-snippets";
import { parseCurl } from "./curl";
import { ExtractVariableDialog } from "./extract-variable-dialog";
import {
  useExecuteRequest,
  useRequest,
  useUpdateRequest,
} from "./request-queries";
import { RevisionDialog } from "../revisions/revision-dialog";
import { useEnvironments } from "../environments/environment-queries";
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

type RequestConfigurationTab =
  | "params"
  | "headers"
  | "body"
  | "auth"
  | "tests";

export function RequestEditor({
  formId = "request-form",
  requestId,
  workspaceId,
  onDirtyChange,
  readOnly = false,
  variables = [],
}: RequestEditorProps) {
  const { t } = useTranslation("requests");
  const request = useRequest(requestId);

  if (request.isPending) {
    return <div className="centered-state">{t("loading")}</div>;
  }
  if (request.isError) {
    return (
      <div className="centered-state">
        <p>{t("loadError")}</p>
        <Button onClick={() => request.refetch()}>{t("retry")}</Button>
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
  const { t } = useTranslation("requests");
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
  const [responseTab, setResponseTab] = useState<
    "body" | "headers" | "tests"
  >("body");
  const [responseSearch, setResponseSearch] = useState("");
  const [showingExtractVariable, setShowingExtractVariable] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>();
  const supportsLocalExecution = Boolean(
    window.devapiDesktop?.executeLocalRequest,
  );
  const mutation = useUpdateRequest(workspaceId, request.id);
  const execution = useExecuteRequest(workspaceId);
  const environments = useEnvironments(workspaceId);
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
  const draftAssertions = watch("assertions");
  const assertionResults = execution.data
    ? evaluateAssertions(draftAssertions, execution.data)
    : [];
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
                executionModeOverride: executionMode,
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
              ? t("status.saving")
              : conflict
                ? t("status.conflict")
                : isDirty
                  ? t("status.unsaved")
                  : t("status.saved", { version: baseVersion }))}
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
                {t("toolbar.importCurl")}
              </Button>
            ) : null}
            <Menu positioning="below-start">
              <MenuTrigger disableButtonEnhancement>
                <Button
                  className="revision-link"
                  size="small"
                  variant="ghost"
                >
                  <Copy20Regular aria-hidden="true" />
                  {t("toolbar.copyCode")}
                  <ChevronDown20Regular aria-hidden="true" />
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  {snippetLanguages.map(({ id, label }) => (
                    <MenuItem
                      key={id}
                      onClick={() => {
                        let snippet: string;
                        try {
                          snippet = formatCodeSnippet(getValues(), id);
                        } catch {
                          setCurlNotice(t("toolbar.codeGenerationFailed"));
                          return;
                        }
                        void navigator.clipboard
                          .writeText(snippet)
                          .then(() => {
                            setCurlNotice(
                              t("toolbar.codeCopied", { label }),
                            );
                            window.setTimeout(
                              () => setCurlNotice(undefined),
                              2_000,
                            );
                          })
                          .catch(() =>
                            setCurlNotice(t("toolbar.codeCopyFailed")),
                          );
                      }}
                    >
                      {label}
                    </MenuItem>
                  ))}
                </MenuList>
              </MenuPopover>
            </Menu>
            <Button
              className="revision-link"
              onClick={() => setShowingRevisions(true)}
              size="small"
              variant="ghost"
            >
              <History20Regular aria-hidden="true" />
              {t("toolbar.versions")}
            </Button>
            {supportsLocalExecution ? (
              <label className="execution-mode-field">
                <span className="sr-only">
                  {t("toolbar.executionModeLabel")}
                </span>
                <Select
                  aria-label={t("toolbar.executionModeLabel")}
                  onChange={(event) =>
                    setExecutionMode(
                      event.target.value === "auto"
                        ? undefined
                        : (event.target.value as ExecutionMode),
                    )
                  }
                  value={executionMode ?? "auto"}
                >
                  <option value="auto">
                    {t("toolbar.executionModeAuto")}
                  </option>
                  <option value="proxy">
                    {t("toolbar.executionModeProxy")}
                  </option>
                  <option value="local">
                    {t("toolbar.executionModeLocal")}
                  </option>
                </Select>
              </label>
            ) : null}
          </div>
        </div>
        <div className="url-bar">
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select
                aria-label={t("methodAriaLabel")}
                disabled={readOnly}
                {...field}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </Select>
            )}
          />
          <Controller
            control={control}
            name="url"
            render={({ field }) => (
              <Input
                aria-label={t("urlAriaLabel")}
                autoComplete="off"
                disabled={readOnly}
                list="request-variable-suggestions"
                spellCheck={false}
                {...field}
              />
            )}
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
              {t("variables.label")}{" "}
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
                {t("variables.undefined", {
                  keys: unresolvedVariables.join(", "),
                })}
              </strong>
            ) : (
              <span className="resolved-url">
                {t("variables.preview", {
                  url: resolveVariables(draftUrl, variables),
                })}
              </span>
            )}
          </div>
        ) : null}

        <TabList
          aria-label={t("tabsAriaLabel")}
          className="fluent-tabs"
          onTabSelect={(_, data) =>
            setActiveTab(data.value as RequestConfigurationTab)
          }
          selectedValue={activeTab}
        >
          {([
            ["params", t("tabs.params")],
            ["headers", t("tabs.headers")],
            ["body", t("tabs.body")],
            ["auth", t("tabs.auth")],
            [
              "tests",
              draftAssertions.length > 0
                ? t("tabs.testsWithCount", { count: draftAssertions.length })
                : t("tabs.tests"),
            ],
          ] as const).map(([id, label]) => (
            <Tab key={id} value={id}>
              {label}
            </Tab>
          ))}
        </TabList>

        <div className="editor-panel">
          {activeTab === "params" ? (
            <KeyValueTable
              emptyLabel={t("params.addLabel")}
              control={control}
              field="queryParams"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "headers" ? (
            <KeyValueTable
              emptyLabel={t("headersTab.addLabel")}
              control={control}
              field="headers"
              register={register}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "body" ? (
            <div className="body-editor">
              <label>
                {t("body.typeLabel")}
                <Select
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
                  <option value="none">{t("body.none")}</option>
                  <option value="json">JSON</option>
                  <option value="text">Text</option>
                  <option value="form-urlencoded">{t("body.form")}</option>
                  <option value="multipart">{t("body.multipart")}</option>
                </Select>
              </label>
              {bodyType === "form-urlencoded" || bodyType === "multipart" ? (
                <p className="security-hint">{t("body.formUrlencodedHint")}</p>
              ) : null}
              {bodyType !== "none" ? (
                <Controller
                  control={control}
                  name="body.content"
                  render={({ field }) => (
                    <Suspense
                      fallback={
                        <div className="editor-loading">
                          {t("body.editorLoading")}
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
                <div className="empty-panel">{t("body.noBody")}</div>
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
                {t("auth.label")}
                <Select
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
                  <option value="none">{t("auth.none")}</option>
                  <option value="bearer">{t("auth.bearer")}</option>
                  <option value="basic">{t("auth.basic")}</option>
                </Select>
              </label>
              {auth.type === "bearer" ? (
                <label>
                  {t("auth.token")}
                  <Input
                    aria-label={t("auth.tokenAriaLabel")}
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
                    {t("auth.username")}
                    <Input
                      aria-label={t("auth.usernameAriaLabel")}
                      autoComplete="username"
                      onChange={(event) =>
                        setAuth({ ...auth, username: event.target.value })
                      }
                      value={auth.username}
                    />
                  </label>
                  <label>
                    {t("auth.password")}
                    <Input
                      aria-label={t("auth.passwordAriaLabel")}
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
              <p className="security-hint">{t("auth.securityHint")}</p>
            </div>
          ) : null}
          {activeTab === "tests" ? (
            <AssertionsEditor control={control} readOnly={readOnly} />
          ) : null}
        </div>

        <section className="response-panel" aria-live="polite">
          <div className="response-heading">
            <h2>{t("response.heading")}</h2>
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
            <div className="response-empty">{t("response.running")}</div>
          ) : execution.isError ? (
            <div className="response-error" role="alert">
              <strong>{t("response.failedHeading")}</strong>
              <p>{execution.error.message}</p>
              {execution.error instanceof RequestExecutionError ? (
                <code>
                  {t("response.errorCode", { code: execution.error.code })}
                </code>
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
                      ? t("response.httpError", {
                          status: execution.data.status,
                        })
                      : t("response.htmlReceived")}
                  </strong>
                  <p>{describeHttpStatus(execution.data.status)}</p>
                  {isHtmlResponse(
                    execution.data.headers,
                    execution.data.body,
                  ) ? (
                    <p>{t("response.htmlNotice")}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="response-toolbar">
                <TabList
                  aria-label={t("response.viewAriaLabel")}
                  className="response-tabs"
                  onTabSelect={(_, data) =>
                    setResponseTab(data.value as "body" | "headers")
                  }
                  selectedValue={responseTab}
                  size="small"
                >
                  <Tab value="body">{t("response.body")}</Tab>
                  <Tab value="headers">
                    {t("response.headers", {
                      count: Object.keys(execution.data.headers).length,
                    })}
                  </Tab>
                  {assertionResults.length > 0 ? (
                    <Tab value="tests">
                      {t("response.tests", {
                        passed: assertionResults.filter(
                          (result) => result.passed,
                        ).length,
                        total: assertionResults.length,
                      })}
                    </Tab>
                  ) : null}
                </TabList>
                <div className="response-actions">
                  <label className="response-search">
                    <Search20Regular aria-hidden="true" />
                    <span className="sr-only">
                      {t("response.searchAriaLabel")}
                    </span>
                    <Input
                      aria-label={t("response.searchAriaLabel")}
                      onChange={(event) => setResponseSearch(event.target.value)}
                      placeholder={t("response.searchPlaceholder")}
                      type="search"
                      value={responseSearch}
                    />
                    {responseSearch ? (
                      <span>
                        {t("response.matches", {
                          count: countMatches(
                            responseTab === "body"
                              ? formatResponseBody(execution.data.body)
                              : formatResponseHeaders(execution.data.headers),
                            responseSearch,
                          ),
                        })}
                      </span>
                    ) : null}
                  </label>
                  <Tooltip
                    content={t("response.copyTooltip")}
                    relationship="description"
                  >
                    <IconButton
                      aria-label={t("response.copyAriaLabel")}
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
                    content={t("response.downloadTooltip")}
                    relationship="description"
                  >
                    <IconButton
                      aria-label={t("response.downloadAriaLabel")}
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
                  {!readOnly ? (
                    <Tooltip
                      content={t("response.extractTooltip")}
                      relationship="description"
                    >
                      <IconButton
                        aria-label={t("response.extractAriaLabel")}
                        onClick={() => setShowingExtractVariable(true)}
                      >
                        <Variable aria-hidden="true" size={18} />
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
              <div className="response-content" role="tabpanel">
                {responseTab === "tests" ? (
                  <ul className="assertion-results">
                    {assertionResults.map((result) => (
                      <li
                        className={
                          result.passed ? "assertion-passed" : "assertion-failed"
                        }
                        key={result.assertion.id}
                      >
                        <span aria-hidden="true">
                          {result.passed ? "✓" : "✗"}
                        </span>
                        {result.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Content can overflow and scroll; tabIndex keeps it reachable by keyboard per WCAG 2.1.1 (scrollable-region-focusable).
                  <pre aria-label={t("response.contentAriaLabel")} role="region" tabIndex={0}>
                    {responseTab === "body"
                      ? formatResponseBody(execution.data.body)
                      : formatResponseHeaders(execution.data.headers)}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="response-empty">{t("response.empty")}</div>
          )}
        </section>
      </form>

      {conflict ? (
        <Dialog
          onClose={() => setConflict(undefined)}
          titleId="conflict-title"
        >
            <h2 id="conflict-title">{t("conflict.title")}</h2>
            <p>
              {t("conflict.description", { version: conflict.currentVersion })}
            </p>
            <dl className="conflict-comparison">
              <div>
                <dt>{t("conflict.yourUrl")}</dt>
                <dd>{getValues("url")}</dd>
              </div>
              <div>
                <dt>{t("conflict.teamUrl")}</dt>
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
                {t("conflict.useTeamVersion")}
              </Button>
              <Button
                onClick={() => setConflict(undefined)}
              >
                {t("conflict.keepEditing")}
              </Button>
              <Button
                disabled={mutation.isPending}
                onClick={() => void save(getValues(), true)}
                variant="primary"
              >
                {t("conflict.saveMine")}
              </Button>
            </DialogFooter>
        </Dialog>
      ) : null}
      {showingExtractVariable && execution.data ? (
        <ExtractVariableDialog
          canEditShared={!readOnly}
          environments={environments.data ?? []}
          onClose={() => setShowingExtractVariable(false)}
          responseBody={execution.data.body}
          workspaceId={workspaceId}
        />
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
            <h2 id="curl-import-title">{t("curlImport.title")}</h2>
            <p>{t("curlImport.description")}</p>
            <Textarea
              aria-label={t("curlImport.commandAriaLabel")}
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
                {t("actions.cancel", { ns: "common" })}
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
                    setCurlNotice(t("curlImport.applied"));
                  } catch (error) {
                    setCurlError(
                      error instanceof Error
                        ? error.message
                        : t("curlImport.invalid"),
                    );
                  }
                }}
                variant="primary"
              >
                {t("curlImport.apply")}
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
  if (i18n.exists(`httpStatus.${status}`, { ns: "requests" })) {
    return i18n.t(`httpStatus.${status}`, { ns: "requests" });
  }
  if (status >= 500) return i18n.t("httpStatus.fallback5xx", { ns: "requests" });
  if (status >= 400) return i18n.t("httpStatus.fallback4xx", { ns: "requests" });
  if (status >= 300) return i18n.t("httpStatus.fallback3xx", { ns: "requests" });
  if (status >= 200) return i18n.t("httpStatus.fallback2xx", { ns: "requests" });
  return i18n.t("httpStatus.fallback1xx", { ns: "requests" });
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
    assertions: request.assertions,
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
  const { t } = useTranslation("requests");
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
        <span>{t("table.key")}</span>
        <span>{t("table.value")}</span>
        <span />
      </div>
      {fields.map((entry, index) => (
        <div className="table-row" key={entry.fieldKey}>
          <input
            aria-label={t("table.enableEntry")}
            disabled={readOnly}
            type="checkbox"
            {...register(`${field}.${index}.enabled`)}
          />
          <Controller
            control={control}
            name={`${field}.${index}.key`}
            render={({ field: controllerField }) => (
              <Input
                aria-label={t("table.key")}
                autoComplete="off"
                disabled={readOnly}
                list={
                  field === "headers"
                    ? "request-header-name-suggestions"
                    : undefined
                }
                placeholder="key"
                {...controllerField}
              />
            )}
          />
          <Controller
            control={control}
            name={`${field}.${index}.value`}
            render={({ field: controllerField }) => (
              <Input
                aria-label={t("table.value")}
                disabled={readOnly}
                placeholder="value"
                {...controllerField}
              />
            )}
          />
          <input type="hidden" {...register(`${field}.${index}.id`)} />
          {!readOnly ? (
            <IconButton
              aria-label={t("table.removeEntry")}
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

function AssertionsEditor({
  control,
  readOnly,
}: {
  control: Control<RequestDraft>;
  readOnly: boolean;
}) {
  const { t } = useTranslation("requests");
  const { append, fields, remove, update } = useFieldArray({
    control,
    keyName: "fieldKey",
    name: "assertions",
  });

  return (
    <div className="assertions-editor">
      <p className="security-hint">{t("assertions.hint")}</p>
      {fields.length === 0 ? (
        <div className="empty-panel">{t("assertions.empty")}</div>
      ) : null}
      {fields.map((entry, index) => (
        <div className="assertion-row" key={entry.fieldKey}>
          <Select
            aria-label={t("assertions.typeAriaLabel")}
            disabled={readOnly}
            onChange={(event) => {
              const type = event.target.value as Assertion["type"];
              update(
                index,
                type === "status"
                  ? {
                      id: entry.id,
                      type: "status",
                      operator: "equals",
                      expected: 200,
                    }
                  : {
                      id: entry.id,
                      type: "jsonPath",
                      path: "",
                      operator: "exists",
                    },
              );
            }}
            value={entry.type}
          >
            <option value="status">{t("assertions.statusCode")}</option>
            <option value="jsonPath">{t("assertions.jsonPath")}</option>
          </Select>
          {entry.type === "status" ? (
            <>
              <Select
                aria-label={t("assertions.statusOperatorAriaLabel")}
                disabled={readOnly}
                onChange={(event) =>
                  update(index, {
                    ...entry,
                    operator: event.target.value as "equals" | "notEquals",
                  })
                }
                value={entry.operator}
              >
                <option value="equals">{t("assertions.equals")}</option>
                <option value="notEquals">{t("assertions.notEquals")}</option>
              </Select>
              <Input
                aria-label={t("assertions.expectedStatusAriaLabel")}
                disabled={readOnly}
                min={100}
                max={599}
                onChange={(event) =>
                  update(index, {
                    ...entry,
                    expected: Number(event.target.value),
                  })
                }
                type="number"
                value={String(entry.expected)}
              />
            </>
          ) : (
            <>
              <Input
                aria-label={t("assertions.jsonPathAriaLabel")}
                disabled={readOnly}
                onChange={(event) =>
                  update(index, { ...entry, path: event.target.value })
                }
                placeholder={t("assertions.jsonPathPlaceholder")}
                value={entry.path}
              />
              <Select
                aria-label={t("assertions.jsonPathOperatorAriaLabel")}
                disabled={readOnly}
                onChange={(event) =>
                  update(index, {
                    ...entry,
                    operator: event.target.value as Extract<
                      Assertion,
                      { type: "jsonPath" }
                    >["operator"],
                  })
                }
                value={entry.operator}
              >
                <option value="exists">{t("assertions.exists")}</option>
                <option value="notExists">{t("assertions.notExists")}</option>
                <option value="equals">{t("assertions.equals")}</option>
                <option value="notEquals">{t("assertions.notEquals")}</option>
                <option value="contains">{t("assertions.contains")}</option>
              </Select>
              {entry.operator === "equals" ||
              entry.operator === "notEquals" ||
              entry.operator === "contains" ? (
                <Input
                  aria-label={t("assertions.expectedValueAriaLabel")}
                  disabled={readOnly}
                  onChange={(event) =>
                    update(index, { ...entry, expected: event.target.value })
                  }
                  placeholder={t("assertions.expectedValuePlaceholder")}
                  value={entry.expected ?? ""}
                />
              ) : null}
            </>
          )}
          {!readOnly ? (
            <IconButton
              aria-label={t("assertions.removeAriaLabel")}
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
              type: "jsonPath",
              path: "",
              operator: "exists",
            })
          }
          size="small"
          variant="ghost"
        >
          <Add20Regular aria-hidden="true" /> {t("assertions.add")}
        </Button>
      ) : null}
    </div>
  );
}
