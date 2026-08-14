import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCollectionSchema,
  type CreateCollection,
} from "@api-client/contracts";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation(["workspaces", "common"]);
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
        aria-label={t("forms.collectionNameLabel")}
        autoFocus
        placeholder={t("forms.collectionNamePlaceholder")}
        {...register("name")}
      />
      <div>
        <Button disabled={mutation.isPending} type="submit" variant="primary">
          {t("actions.create", { ns: "common" })}
        </Button>
        <Button onClick={onClose}>
          {t("actions.cancel", { ns: "common" })}
        </Button>
      </div>
      {formState.errors.name || mutation.isError ? (
        <p className="field-error">
          {formState.errors.name?.message ??
            t("forms.collectionCreateError")}
        </p>
      ) : null}
    </form>
  );
}
