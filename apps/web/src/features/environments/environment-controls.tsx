import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEnvironmentSchema,
  upsertEnvironmentVariableSchema,
  type CreateEnvironment,
  type Environment,
  type EnvironmentVariable,
  type UpsertEnvironmentVariable,
} from "@api-client/contracts";
import { Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  IconButton,
  Input,
  Select,
} from "../../components/ui";
import {
  EnvironmentConflictError,
  EnvironmentVariableConflictError,
} from "./environment-api";
import {
  useCreateEnvironment,
  useCreateEnvironmentVariable,
  useDeleteEnvironment,
  useDeleteEnvironmentVariable,
  useEnvironments,
  useUpdateEnvironment,
  useUpdateEnvironmentVariable,
} from "./environment-queries";

interface EnvironmentControlsProps {
  canEditShared: boolean;
  selectedId: string | undefined;
  onSelect: (environmentId: string | undefined) => void;
  workspaceId: string;
}

export function EnvironmentControls({
  canEditShared,
  selectedId,
  onSelect,
  workspaceId,
}: EnvironmentControlsProps) {
  const environments = useEnvironments(workspaceId);
  const [mode, setMode] = useState<"environment" | "variable">();
  const [error, setError] = useState<string>();
  const selected = environments.data?.find(({ id }) => id === selectedId);
  const updateEnvironment = useUpdateEnvironment(
    workspaceId,
    selected?.id ?? "",
  );
  const deleteEnvironment = useDeleteEnvironment(
    workspaceId,
    selected?.id ?? "",
  );

  useEffect(() => {
    if (!selectedId && environments.data?.[0]) {
      onSelect(environments.data[0].id);
    }
  }, [environments.data, onSelect, selectedId]);

  return (
    <div className="environment-controls">
      <label>
        <span className="sr-only">Aktive Umgebung</span>
        <Select
          aria-label="Aktive Umgebung"
          onChange={(event) => onSelect(event.target.value || undefined)}
          value={selectedId ?? ""}
        >
          <option value="">Keine Umgebung</option>
          {environments.data?.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name}
            </option>
          ))}
        </Select>
      </label>
      {canEditShared ? (
        <IconButton
          aria-label="Umgebung erstellen"
          onClick={() => setMode("environment")}
          size="compact"
        >
          <Plus aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {selected ? (
        <IconButton
          aria-label="Variable hinzufügen"
          onClick={() => setMode("variable")}
          size="compact"
        >
          <Settings2 aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {selected && canEditShared ? (
        <>
          <IconButton
            aria-label={`${selected.name} umbenennen`}
            onClick={() => {
              const name = window.prompt("Neuer Umgebungsname", selected.name);
              if (!name?.trim() || name.trim() === selected.name) return;
              setError(undefined);
              void updateEnvironment
                .mutateAsync({ name: name.trim(), expectedVersion: selected.version })
                .catch((mutationError: unknown) =>
                  setError(
                    mutationError instanceof EnvironmentConflictError
                      ? "Die Umgebung wurde zwischenzeitlich geändert."
                      : "Die Umgebung konnte nicht umbenannt werden.",
                  ),
                );
            }}
            size="compact"
          >
            <Pencil aria-hidden="true" size={14} />
          </IconButton>
          <IconButton
            aria-label={`${selected.name} löschen`}
            onClick={() => {
              if (
                !window.confirm(
                  `Umgebung „${selected.name}“ inklusive aller Variablen löschen?`,
                )
              ) {
                return;
              }
              setError(undefined);
              void deleteEnvironment
                .mutateAsync({ expectedVersion: selected.version })
                .then(() => onSelect(undefined))
                .catch((mutationError: unknown) =>
                  setError(
                    mutationError instanceof EnvironmentConflictError
                      ? "Die Umgebung wurde zwischenzeitlich geändert."
                      : "Die Umgebung konnte nicht gelöscht werden.",
                  ),
                );
            }}
            size="compact"
            variant="danger"
          >
            <Trash2 aria-hidden="true" size={14} />
          </IconButton>
        </>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}
      {mode === "environment" ? (
        <EnvironmentCreatePopover
          onClose={() => setMode(undefined)}
          onCreated={(id) => onSelect(id)}
          workspaceId={workspaceId}
        />
      ) : null}
      {mode === "variable" && selected ? (
        <VariableCreatePopover
          canEditShared={canEditShared}
          environment={selected}
          onClose={() => setMode(undefined)}
          workspaceId={workspaceId}
        />
      ) : null}
    </div>
  );
}

function EnvironmentCreatePopover({
  onClose,
  onCreated,
  workspaceId,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  workspaceId: string;
}) {
  const mutation = useCreateEnvironment(workspaceId);
  const { handleSubmit, register, formState } = useForm<CreateEnvironment>({
    resolver: zodResolver(createEnvironmentSchema),
    defaultValues: { name: "" },
  });
  return (
    <form
      className="environment-popover"
      onSubmit={handleSubmit(async (input) => {
        const environment = await mutation.mutateAsync(input);
        onCreated(environment.id);
        onClose();
      })}
    >
      <strong>Umgebung erstellen</strong>
      <Input
        aria-label="Umgebungsname"
        autoFocus
        placeholder="z. B. Entwicklung"
        {...register("name")}
      />
      <PopoverActions
        isPending={mutation.isPending}
        onClose={onClose}
      />
      {formState.errors.name || mutation.isError ? (
        <p className="field-error">
          {formState.errors.name?.message ??
            "Umgebung konnte nicht erstellt werden."}
        </p>
      ) : null}
    </form>
  );
}

function VariableCreatePopover({
  canEditShared,
  environment,
  onClose,
  workspaceId,
}: {
  canEditShared: boolean;
  environment: Environment;
  onClose: () => void;
  workspaceId: string;
}) {
  const mutation = useCreateEnvironmentVariable(
    workspaceId,
    environment.id,
  );
  const { handleSubmit, register, watch, formState } =
    useForm<UpsertEnvironmentVariable>({
      resolver: zodResolver(upsertEnvironmentVariableSchema),
      defaultValues: {
        key: "",
        value: "",
        scope: canEditShared ? "shared" : "personal",
      },
    });
  const scope = watch("scope");
  return (
    <form
      className="environment-popover"
      onSubmit={handleSubmit(async (input) => {
        await mutation.mutateAsync(input);
        onClose();
      })}
    >
      <strong>Variable hinzufügen</strong>
      <div className="environment-variable-list">
        {environment.variables.map((variable) => (
          <EnvironmentVariableRow
            canEdit={variable.scope === "personal" || canEditShared}
            key={variable.id}
            variable={variable}
            workspaceId={workspaceId}
          />
        ))}
      </div>
      <Input
        aria-label="Variablenname"
        placeholder="baseUrl"
        {...register("key")}
      />
      <Input
        aria-label="Variablenwert"
        autoComplete="off"
        placeholder="Wert"
        type={scope === "personal" ? "password" : "text"}
        {...register("value")}
      />
      <Select aria-label="Variablenbereich" {...register("scope")}>
        {canEditShared ? <option value="shared">Mit Team geteilt</option> : null}
        <option value="personal">Nur für mich</option>
      </Select>
      <p className="security-hint">
        {scope === "shared"
          ? "Dieser Wert ist für alle Workspace-Mitglieder sichtbar. Hier keine Tokens oder Passwörter speichern."
          : "Dieser Wert ist nur über deine eigene Anmeldung lesbar und überschreibt einen gleichnamigen Teamwert."}
      </p>
      <PopoverActions isPending={mutation.isPending} onClose={onClose} />
      {formState.errors.key || mutation.isError ? (
        <p className="field-error">
          {formState.errors.key?.message ??
            "Variable konnte nicht erstellt werden."}
        </p>
      ) : null}
    </form>
  );
}

export function EnvironmentVariableRow({
  canEdit,
  variable,
  workspaceId,
}: {
  canEdit: boolean;
  variable: EnvironmentVariable;
  workspaceId: string;
}) {
  const mutation = useUpdateEnvironmentVariable(workspaceId, variable.id);
  const removeVariable = useDeleteEnvironmentVariable(
    workspaceId,
    variable.id,
  );
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(variable.value);
  const [baseVersion, setBaseVersion] = useState(variable.version);
  const [rowError, setRowError] = useState<string>();
  const conflict =
    mutation.error instanceof EnvironmentVariableConflictError
      ? mutation.error.conflict
      : undefined;

  if (!editing) {
    return (
      <div className="environment-variable-row">
        <span>
          <strong>{variable.key}</strong>
          <small>
            {variable.scope === "personal" ? "Nur für mich" : "Teamwert"} ·
            Version {variable.version}
          </small>
        </span>
        <code>{variable.scope === "personal" ? "••••••••" : variable.value}</code>
        {canEdit ? (
          <>
            <Button onClick={() => setEditing(true)}>Bearbeiten</Button>
            <IconButton
              aria-label={`${variable.key} umbenennen`}
              onClick={() => {
                const key = window.prompt("Neuer Variablenname", variable.key);
                if (!key?.trim() || key.trim() === variable.key) return;
                setRowError(undefined);
                void mutation
                  .mutateAsync({
                    key: key.trim(),
                    expectedVersion: variable.version,
                  })
                  .catch(() =>
                    setRowError("Die Variable konnte nicht umbenannt werden."),
                  );
              }}
              size="compact"
            >
              <Pencil aria-hidden="true" size={14} />
            </IconButton>
            <IconButton
              aria-label={`${variable.key} entfernen`}
              onClick={() => {
                if (
                  !window.confirm(`Variable „${variable.key}“ entfernen?`)
                ) {
                  return;
                }
                setRowError(undefined);
                void removeVariable
                  .mutateAsync({ expectedVersion: variable.version })
                  .catch(() =>
                    setRowError("Die Variable konnte nicht entfernt werden."),
                  );
              }}
              size="compact"
              variant="danger"
            >
              <Trash2 aria-hidden="true" size={14} />
            </IconButton>
          </>
        ) : null}
        {rowError ? <p className="field-error">{rowError}</p> : null}
      </div>
    );
  }

  const expectedVersion = conflict?.currentVersion ?? baseVersion;
  return (
    <div className="environment-variable-edit">
      <strong>{variable.key}</strong>
      <Input
        aria-label={`${variable.key} bearbeiten`}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        type={variable.scope === "personal" ? "password" : "text"}
        value={value}
      />
      {conflict ? (
        <p className="field-error">
          Die Variable ist inzwischen Version {conflict.currentVersion}. Dein
          eingegebener Wert bleibt erhalten.
        </p>
      ) : null}
      <div className="dialog-actions">
        {conflict ? (
          <Button
            onClick={() => {
              setValue(conflict.current.value);
              setBaseVersion(conflict.currentVersion);
              mutation.reset();
            }}
          >
            Aktuellen Wert übernehmen
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setValue(variable.value);
            setBaseVersion(variable.version);
            mutation.reset();
            setEditing(false);
          }}
        >
          Abbrechen
        </Button>
        <Button
          disabled={mutation.isPending}
          onClick={async () => {
            await mutation
              .mutateAsync({ value, expectedVersion })
              .then(() => setEditing(false))
              .catch(() => undefined);
          }}
          variant="primary"
        >
          {conflict ? "Meinen Wert speichern" : "Speichern"}
        </Button>
      </div>
    </div>
  );
}

function PopoverActions({
  isPending,
  onClose,
}: {
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="dialog-actions">
      <Button onClick={onClose}>
        Abbrechen
      </Button>
      <Button disabled={isPending} type="submit" variant="primary">
        Speichern
      </Button>
    </div>
  );
}
