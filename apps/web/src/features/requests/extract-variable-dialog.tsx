import type { Environment } from "@api-client/contracts";
import { useState } from "react";

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
          <h2 id="extract-variable-title">Wert in Variable speichern</h2>
          <p id="extract-variable-description">
            Extrahiert einen Wert aus der JSON-Response in eine
            Umgebungsvariable.
          </p>
        </div>
      </DialogHeader>
      <DialogBody>
        {parsedBody === undefined ? (
          <FieldError>
            Die Response ist kein gültiges JSON und kann nicht durchsucht
            werden.
          </FieldError>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="extract-variable-path">
                Pfad in der Response
              </FieldLabel>
              <Input
                aria-describedby="extract-variable-preview"
                autoFocus
                id="extract-variable-path"
                onChange={(event) => setPath(event.target.value)}
                placeholder="z. B. data.token oder items[0].id"
                value={path}
              />
              <p id="extract-variable-preview" className="security-hint">
                {path.trim() === ""
                  ? "Gib einen Pfad ein, z. B. token oder data.items[0].id."
                  : resolution.found
                    ? `Gefunden: ${extractedValue}`
                    : "Unter diesem Pfad wurde kein Wert gefunden."}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="extract-variable-environment">
                Umgebung
              </FieldLabel>
              <Select
                id="extract-variable-environment"
                onChange={(event) => setEnvironmentId(event.target.value)}
                value={environmentId}
              >
                {environments.length === 0 ? (
                  <option value="">Keine Umgebung vorhanden</option>
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
                Variablenname
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
                Es gibt bereits eine Variable „{existingVariable.key}“
                ({existingVariable.scope === "personal"
                  ? "nur für mich"
                  : "mit Team geteilt"}) in dieser Umgebung. Sie wird
                überschrieben.
              </p>
            ) : (
              <Field>
                <FieldLabel htmlFor="extract-variable-scope">
                  Sichtbarkeit
                </FieldLabel>
                <Select
                  id="extract-variable-scope"
                  onChange={(event) =>
                    setScope(event.target.value as "shared" | "personal")
                  }
                  value={scope}
                >
                  {canEditShared ? (
                    <option value="shared">Mit Team geteilt</option>
                  ) : null}
                  <option value="personal">Nur für mich</option>
                </Select>
              </Field>
            )}
            {mutationError ? (
              <FieldError>
                {mutationError instanceof EnvironmentVariableConflictError
                  ? "Die Variable wurde zwischenzeitlich geändert."
                  : "Die Variable konnte nicht gespeichert werden."}
              </FieldError>
            ) : null}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          disabled={!canSave || isPending}
          onClick={save}
          variant="primary"
        >
          Speichern
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
