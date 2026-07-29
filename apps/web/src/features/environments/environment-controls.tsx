import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEnvironmentSchema,
  upsertEnvironmentVariableSchema,
  type CreateEnvironment,
  type Environment,
  type EnvironmentVariable,
  type UpsertEnvironmentVariable,
} from "@api-client/contracts";
import { Plus, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  EnvironmentVariableConflictError,
} from "./environment-api";
import {
  useCreateEnvironment,
  useCreateEnvironmentVariable,
  useEnvironments,
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
  const selected = environments.data?.find(({ id }) => id === selectedId);

  useEffect(() => {
    if (!selectedId && environments.data?.[0]) {
      onSelect(environments.data[0].id);
    }
  }, [environments.data, onSelect, selectedId]);

  return (
    <div className="environment-controls">
      <label>
        <span className="sr-only">Aktive Umgebung</span>
        <select
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
        </select>
      </label>
      {canEditShared ? (
        <button
          aria-label="Umgebung erstellen"
          className="icon-button compact"
          onClick={() => setMode("environment")}
          type="button"
        >
          <Plus aria-hidden="true" size={15} />
        </button>
      ) : null}
      {selected ? (
        <button
          aria-label="Variable hinzufügen"
          className="icon-button compact"
          onClick={() => setMode("variable")}
          type="button"
        >
          <Settings2 aria-hidden="true" size={15} />
        </button>
      ) : null}
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
      <input
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
      <input
        aria-label="Variablenname"
        placeholder="baseUrl"
        {...register("key")}
      />
      <input
        aria-label="Variablenwert"
        autoComplete="off"
        placeholder="Wert"
        type={scope === "personal" ? "password" : "text"}
        {...register("value")}
      />
      <select aria-label="Variablenbereich" {...register("scope")}>
        {canEditShared ? <option value="shared">Mit Team geteilt</option> : null}
        <option value="personal">Nur für mich</option>
      </select>
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
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(variable.value);
  const [baseVersion, setBaseVersion] = useState(variable.version);
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
          <button
            className="button secondary"
            onClick={() => setEditing(true)}
            type="button"
          >
            Bearbeiten
          </button>
        ) : null}
      </div>
    );
  }

  const expectedVersion = conflict?.currentVersion ?? baseVersion;
  return (
    <div className="environment-variable-edit">
      <strong>{variable.key}</strong>
      <input
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
          <button
            className="button secondary"
            onClick={() => {
              setValue(conflict.current.value);
              setBaseVersion(conflict.currentVersion);
              mutation.reset();
            }}
            type="button"
          >
            Aktuellen Wert übernehmen
          </button>
        ) : null}
        <button
          className="button secondary"
          onClick={() => {
            setValue(variable.value);
            setBaseVersion(variable.version);
            mutation.reset();
            setEditing(false);
          }}
          type="button"
        >
          Abbrechen
        </button>
        <button
          className="button primary"
          disabled={mutation.isPending}
          onClick={async () => {
            await mutation
              .mutateAsync({ value, expectedVersion })
              .then(() => setEditing(false))
              .catch(() => undefined);
          }}
          type="button"
        >
          {conflict ? "Meinen Wert speichern" : "Speichern"}
        </button>
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
      <button className="button secondary" onClick={onClose} type="button">
        Abbrechen
      </button>
      <button className="button primary" disabled={isPending}>
        Speichern
      </button>
    </div>
  );
}
