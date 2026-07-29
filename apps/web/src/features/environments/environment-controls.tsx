import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEnvironmentSchema,
  upsertEnvironmentVariableSchema,
  type CreateEnvironment,
  type UpsertEnvironmentVariable,
} from "@api-client/contracts";
import { Plus, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  useCreateEnvironment,
  useCreateEnvironmentVariable,
  useEnvironments,
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
          environmentId={selected.id}
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
  environmentId,
  onClose,
  workspaceId,
}: {
  canEditShared: boolean;
  environmentId: string;
  onClose: () => void;
  workspaceId: string;
}) {
  const mutation = useCreateEnvironmentVariable(
    workspaceId,
    environmentId,
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
