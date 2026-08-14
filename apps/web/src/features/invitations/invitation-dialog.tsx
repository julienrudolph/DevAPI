import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTeamInvitationSchema,
  type CreateTeamInvitation,
} from "@api-client/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Select,
} from "../../components/ui";
import { useCreateInvitation } from "./invitation-queries";

export function InvitationDialog({
  onClose,
  teamId,
}: {
  onClose: () => void;
  teamId: string;
}) {
  const { t } = useTranslation(["teams", "common"]);
  const mutation = useCreateInvitation(teamId);
  const [copied, setCopied] = useState(false);
  const { handleSubmit, register } = useForm<CreateTeamInvitation>({
    resolver: zodResolver(createTeamInvitationSchema),
    defaultValues: { role: "editor" },
  });
  const invitationUrl = mutation.data
    ? `${window.location.origin}/invitations/${mutation.data.token}`
    : undefined;

  return (
    <Dialog onClose={onClose} titleId="invitation-title">
      <h2 id="invitation-title">{t("invitation.title")}</h2>
      <DialogBody>
        {invitationUrl ? (
          <>
            <p>{t("invitation.linkHint")}</p>
            <Input
              aria-label={t("invitation.linkLabel")}
              className="invitation-link"
              readOnly
              value={invitationUrl}
            />
            <DialogFooter>
              <Button
                onClick={() => {
                  void navigator.clipboard
                    .writeText(invitationUrl)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
                type="button"
              >
                {copied ? t("invitation.copied") : t("invitation.copyLink")}
              </Button>
              <Button onClick={onClose} variant="primary">
                {t("actions.done", { ns: "common" })}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit((input) => mutation.mutate(input))}>
            <Field className="invitation-role">
              <FieldLabel htmlFor="invitation-role">
                {t("invitation.roleLabel")}
              </FieldLabel>
              <Select id="invitation-role" {...register("role")}>
                <option value="editor">{t("members.roleEditor")}</option>
                <option value="viewer">{t("members.roleViewer")}</option>
              </Select>
            </Field>
            {mutation.isError ? (
              <FieldError>{t("invitation.createError")}</FieldError>
            ) : null}
            <DialogFooter>
              <Button onClick={onClose}>
                {t("actions.cancel", { ns: "common" })}
              </Button>
              <Button
                disabled={mutation.isPending}
                type="submit"
                variant="primary"
              >
                {t("invitation.createLink")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogBody>
    </Dialog>
  );
}
