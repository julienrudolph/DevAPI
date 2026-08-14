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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["environments", "common"]);
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
        <span className="sr-only">{t("activeEnvironment")}</span>
        <Select
          aria-label={t("activeEnvironment")}
          onChange={(event) => onSelect(event.target.value || undefined)}
          value={selectedId ?? ""}
        >
          <option value="">{t("noEnvironment")}</option>
          {environments.data?.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name}
            </option>
          ))}
        </Select>
      </label>
      {canEditShared ? (
        <IconButton
          aria-label={t("createEnvironment")}
          onClick={() => setMode("environment")}
          size="compact"
        >
          <Plus aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {selected ? (
        <IconButton
          aria-label={t("addVariable")}
          onClick={() => setMode("variable")}
          size="compact"
        >
          <Settings2 aria-hidden="true" size={15} />
        </IconButton>
      ) : null}
      {selected && canEditShared ? (
        <>
          <IconButton
            aria-label={t("renameEnvironment", { name: selected.name })}
            onClick={() => {
              const name = window.prompt(
                t("newEnvironmentNamePrompt"),
                selected.name,
              );
              if (!name?.trim() || name.trim() === selected.name) return;
              setError(undefined);
              void updateEnvironment
                .mutateAsync({ name: name.trim(), expectedVersion: selected.version })
                .catch((mutationError: unknown) =>
                  setError(
                    mutationError instanceof EnvironmentConflictError
                      ? t("environmentChangedConflict")
                      : t("environmentRenameFailed"),
                  ),
                );
            }}
            size="compact"
          >
            <Pencil aria-hidden="true" size={14} />
          </IconButton>
          <IconButton
            aria-label={t("deleteEnvironment", { name: selected.name })}
            onClick={() => {
              if (
                !window.confirm(
                  t("deleteEnvironmentConfirm", { name: selected.name }),
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
                      ? t("environmentChangedConflict")
                      : t("environmentDeleteFailed"),
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
  const { t } = useTranslation("environments");
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
      <strong>{t("createEnvironment")}</strong>
      <Input
        aria-label={t("environmentNameLabel")}
        autoFocus
        placeholder={t("environmentNamePlaceholder")}
        {...register("name")}
      />
      <PopoverActions
        isPending={mutation.isPending}
        onClose={onClose}
      />
      {formState.errors.name || mutation.isError ? (
        <p className="field-error">
          {formState.errors.name?.message ?? t("environmentCreateError")}
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
  const { t } = useTranslation("environments");
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
      <strong>{t("addVariable")}</strong>
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
        aria-label={t("variableNameLabel")}
        placeholder="baseUrl"
        {...register("key")}
      />
      <Input
        aria-label={t("variableValueLabel")}
        autoComplete="off"
        placeholder={t("valuePlaceholder")}
        type={scope === "personal" ? "password" : "text"}
        {...register("value")}
      />
      <Select aria-label={t("variableScopeLabel")} {...register("scope")}>
        {canEditShared ? (
          <option value="shared">{t("scopeShared")}</option>
        ) : null}
        <option value="personal">{t("scopePersonal")}</option>
      </Select>
      <p className="security-hint">
        {scope === "shared" ? t("sharedHint") : t("personalHint")}
      </p>
      <PopoverActions isPending={mutation.isPending} onClose={onClose} />
      {formState.errors.key || mutation.isError ? (
        <p className="field-error">
          {formState.errors.key?.message ?? t("variableCreateError")}
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
  const { t } = useTranslation(["environments", "common"]);
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
            {variable.scope === "personal"
              ? t("variableScopePersonalLabel")
              : t("variableScopeTeamLabel")}{" "}
            · {t("versionLabel", { version: variable.version })}
          </small>
        </span>
        <code>{variable.scope === "personal" ? "••••••••" : variable.value}</code>
        {canEdit ? (
          <>
            <Button onClick={() => setEditing(true)}>
              {t("actions.edit", { ns: "common" })}
            </Button>
            <IconButton
              aria-label={t("renameVariable", { key: variable.key })}
              onClick={() => {
                const key = window.prompt(
                  t("newVariableNamePrompt"),
                  variable.key,
                );
                if (!key?.trim() || key.trim() === variable.key) return;
                setRowError(undefined);
                void mutation
                  .mutateAsync({
                    key: key.trim(),
                    expectedVersion: variable.version,
                  })
                  .catch(() => setRowError(t("variableRenameFailed")));
              }}
              size="compact"
            >
              <Pencil aria-hidden="true" size={14} />
            </IconButton>
            <IconButton
              aria-label={t("removeVariable", { key: variable.key })}
              onClick={() => {
                if (
                  !window.confirm(
                    t("removeVariableConfirm", { key: variable.key }),
                  )
                ) {
                  return;
                }
                setRowError(undefined);
                void removeVariable
                  .mutateAsync({ expectedVersion: variable.version })
                  .catch(() => setRowError(t("variableRemoveFailed")));
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
        aria-label={t("editVariable", { key: variable.key })}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        type={variable.scope === "personal" ? "password" : "text"}
        value={value}
      />
      {conflict ? (
        <p className="field-error">
          {t("conflictNotice", { version: conflict.currentVersion })}
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
            {t("useCurrentValue")}
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
          {t("actions.cancel", { ns: "common" })}
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
          {conflict ? t("saveMyValue") : t("actions.save", { ns: "common" })}
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
  const { t } = useTranslation("common");
  return (
    <div className="dialog-actions">
      <Button onClick={onClose}>
        {t("actions.cancel")}
      </Button>
      <Button disabled={isPending} type="submit" variant="primary">
        {t("actions.save")}
      </Button>
    </div>
  );
}
