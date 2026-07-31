import { zodResolver } from "@hookform/resolvers/zod";
import {
  createFolderSchema,
  createRequestSummarySchema,
  type CreateFolder,
  type CreateRequestSummary,
} from "@api-client/contracts";
import { useForm } from "react-hook-form";

import { useCreateFolder, useCreateRequest } from "./workspace-queries";

interface CreateFormProps {
  collectionId: string;
  workspaceId: string;
  onClose: () => void;
}

interface FolderCreateFormProps extends CreateFormProps {
  parentFolderId?: string | null;
}

export function FolderCreateForm({
  collectionId,
  workspaceId,
  onClose,
  parentFolderId = null,
}: FolderCreateFormProps) {
  const mutation = useCreateFolder(workspaceId);
  const { formState, handleSubmit, register } = useForm<CreateFolder>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { collectionId, parentFolderId, name: "" },
  });

  return (
    <form
      className="inline-create-form nested-create-form"
      onSubmit={handleSubmit(async (input) => {
        await mutation.mutateAsync(input);
        onClose();
      })}
    >
      <input
        aria-label="Ordnername"
        autoFocus
        placeholder="Neuer Ordner"
        {...register("name")}
      />
      <CreateActions isPending={mutation.isPending} onClose={onClose} />
      <CreateError
        message={formState.errors.name?.message}
        mutationError={mutation.isError}
        fallback="Ordner konnte nicht erstellt werden."
      />
    </form>
  );
}

interface RequestCreateFormProps extends CreateFormProps {
  folderId?: string | null;
  onCreated: (requestId: string) => void;
}

export function RequestCreateForm({
  collectionId,
  folderId = null,
  workspaceId,
  onClose,
  onCreated,
}: RequestCreateFormProps) {
  const mutation = useCreateRequest(workspaceId);
  const { formState, handleSubmit, register } =
    useForm<CreateRequestSummary>({
      resolver: zodResolver(createRequestSummarySchema),
      defaultValues: {
        collectionId,
        folderId,
        name: "",
        method: "GET",
        url: "https://",
      },
    });

  return (
    <form
      className="inline-create-form nested-create-form"
      onSubmit={handleSubmit(async (input) => {
        const request = await mutation.mutateAsync(input);
        onCreated(request.id);
        onClose();
      })}
    >
      <input
        aria-label="Request-Name"
        autoFocus
        placeholder="Neuer Request"
        {...register("name")}
      />
      <CreateActions isPending={mutation.isPending} onClose={onClose} />
      <CreateError
        message={formState.errors.name?.message}
        mutationError={mutation.isError}
        fallback="Request konnte nicht erstellt werden."
      />
    </form>
  );
}

function CreateActions({
  isPending,
  onClose,
}: {
  isPending: boolean;
  onClose: () => void;
}) {
  return (
    <div>
      <button className="button primary" disabled={isPending}>
        Erstellen
      </button>
      <button className="button secondary" onClick={onClose} type="button">
        Abbrechen
      </button>
    </div>
  );
}

function CreateError({
  message,
  mutationError,
  fallback,
}: {
  message: string | undefined;
  mutationError: boolean;
  fallback: string;
}) {
  return message || mutationError ? (
    <p className="field-error">{message ?? fallback}</p>
  ) : null;
}
