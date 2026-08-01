import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCollectionSchema,
  type CreateCollection,
} from "@api-client/contracts";
import { useForm } from "react-hook-form";

import { Button, Input } from "../../components/ui";
import { useCreateCollection } from "./workspace-queries";

interface CollectionCreateFormProps {
  workspaceId: string;
  onClose: () => void;
}

export function CollectionCreateForm({
  workspaceId,
  onClose,
}: CollectionCreateFormProps) {
  const mutation = useCreateCollection(workspaceId);
  const { formState, handleSubmit, register } = useForm<CreateCollection>({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: { name: "" },
  });

  async function submit(input: CreateCollection) {
    await mutation.mutateAsync(input);
    onClose();
  }

  return (
    <form className="inline-create-form" onSubmit={handleSubmit(submit)}>
      <Input
        aria-label="Collection-Name"
        autoFocus
        placeholder="Neue Collection"
        {...register("name")}
      />
      <div>
        <Button disabled={mutation.isPending} type="submit" variant="primary">
          Erstellen
        </Button>
        <Button onClick={onClose}>
          Abbrechen
        </Button>
      </div>
      {formState.errors.name || mutation.isError ? (
        <p className="field-error">
          {formState.errors.name?.message ??
            "Collection konnte nicht erstellt werden."}
        </p>
      ) : null}
    </form>
  );
}
