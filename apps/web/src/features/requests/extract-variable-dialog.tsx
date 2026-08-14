import type { Environment } from "@api-client/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
} from "../../components/ui";
import { EnvironmentVariableConflictError } from "../environments/environment-api";
import {
  useCreateEnvironmentVariable,
  useUpdateEnvironmentVariable,
} from "../environments/environment-queries";
import {
  resolveJsonPath,
  stringifyExtractedValue,
  tryParseJson,
} from "../environments/json-path";

export function ExtractVariableDialog({
  canEditShared,
  environments,
  onClose,
  responseBody,
  workspaceId,
}: {
  canEditShared: boolean;
  environments: Environment[];
  onClose: () => void;
  responseBody: string;
  workspaceId: string;
}) {
  const { t } = useTranslation(["requests", "common"]);
  const [path, setPath] = useState("");
  const [environmentId, setEnvironmentId] = useState(
    environments[0]?.id ?? "",
  );
  const [variableName, setVariableName] = useState("");
  const [scope, setScope] = useState<"shared" | "personal">(
    canEditShared ? "shared" : "personal",
  );

  const parsedBody = tryParseJson(responseBody);
  const resolution =
    parsedBody === undefined ? { found: false as const } : resolveJsonPath(parsedBody, path);
  const extractedValue = resolution.found
    ? stringifyExtractedValue(resolution.value)
    : undefined;

  const environment = environments.find((item) => item.id === environmentId);
  const existingVariable = environment?.variables.find(
    (variable) => variable.key === variableName.trim(),
  );

  const createVariable = useCreateEnvironmentVariable(
    workspaceId,
    environmentId,
  );
  const updateVariable = useUpdateEnvironmentVariable(
    workspaceId,
    existingVariable?.id ?? "",
  );
  const isPending = createVariable.isPending || updateVariable.isPending;
  const mutationError = createVariable.error ?? updateVariable.error;

  const canSave =
    parsedBody !== undefined &&
    resolution.found &&
    extractedValue !== undefined &&
    environmentId !== "" &&
    variableName.trim() !== "";

  function save() {
    if (!canSave || extractedValue === undefined) return;
    const result = existingVariable
      ? updateVariable.mutateAsync({
          value: extractedValue,
          expectedVersion: existingVariable.version,
        })
      : createVariable.mutateAsync({
          key: variableName.trim(),
          value: extractedValue,
          scope,
        });
    void result.then(onClose).catch(() => undefined);
  }

  return (
    <Dialog
      descriptionId="extract-variable-description"
      onClose={onClose}
      titleId="extract-variable-title"
    >
      <DialogHeader>
        <div>
          <h2 id="extract-variable-title">{t("extractVariable.title")}</h2>
          <p id="extract-variable-description">
            {t("extractVariable.description")}
          </p>
        </div>
      </DialogHeader>
      <DialogBody>
        {parsedBody === undefined ? (
          <FieldError>{t("extractVariable.invalidJson")}</FieldError>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="extract-variable-path">
                {t("extractVariable.pathLabel")}
              </FieldLabel>
              <Input
                aria-describedby="extract-variable-preview"
                autoFocus
                id="extract-variable-path"
                onChange={(event) => setPath(event.target.value)}
                placeholder={t("extractVariable.pathPlaceholder")}
                value={path}
              />
              <p id="extract-variable-preview" className="security-hint">
                {path.trim() === ""
                  ? t("extractVariable.pathHintEmpty")
                  : resolution.found
                    ? t("extractVariable.pathHintFound", {
                        value: extractedValue,
                      })
                    : t("extractVariable.pathHintNotFound")}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="extract-variable-environment">
                {t("extractVariable.environmentLabel")}
              </FieldLabel>
              <Select
                id="extract-variable-environment"
                onChange={(event) => setEnvironmentId(event.target.value)}
                value={environmentId}
              >
                {environments.length === 0 ? (
                  <option value="">{t("extractVariable.noEnvironment")}</option>
                ) : null}
                {environments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="extract-variable-name">
                {t("extractVariable.nameLabel")}
              </FieldLabel>
              <Input
                id="extract-variable-name"
                onChange={(event) => setVariableName(event.target.value)}
                placeholder="baseUrl"
                value={variableName}
              />
            </Field>
            {existingVariable ? (
              <p className="security-hint">
                {t("extractVariable.existingVariable", {
                  key: existingVariable.key,
                  scope:
                    existingVariable.scope === "personal"
                      ? t("extractVariable.scopePersonal")
                      : t("extractVariable.scopeShared"),
                })}
              </p>
            ) : (
              <Field>
                <FieldLabel htmlFor="extract-variable-scope">
                  {t("extractVariable.visibilityLabel")}
                </FieldLabel>
                <Select
                  id="extract-variable-scope"
                  onChange={(event) =>
                    setScope(event.target.value as "shared" | "personal")
                  }
                  value={scope}
                >
                  {canEditShared ? (
                    <option value="shared">
                      {t("extractVariable.sharedOption")}
                    </option>
                  ) : null}
                  <option value="personal">
                    {t("extractVariable.personalOption")}
                  </option>
                </Select>
              </Field>
            )}
            {mutationError ? (
              <FieldError>
                {mutationError instanceof EnvironmentVariableConflictError
                  ? t("extractVariable.conflictError")
                  : t("extractVariable.saveError")}
              </FieldError>
            ) : null}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>{t("actions.cancel", { ns: "common" })}</Button>
        <Button
          disabled={!canSave || isPending}
          onClick={save}
          variant="primary"
        >
          {t("actions.save", { ns: "common" })}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
