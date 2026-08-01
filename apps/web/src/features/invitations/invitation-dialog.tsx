import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTeamInvitationSchema,
  type CreateTeamInvitation,
} from "@api-client/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
      <h2 id="invitation-title">Teammitglied einladen</h2>
      <DialogBody>
        {invitationUrl ? (
          <>
            <p>
              Dieser Link ist sieben Tage gültig und kann einmal angenommen
              werden. Der Token wird serverseitig nur gehasht gespeichert.
            </p>
            <Input
              aria-label="Einladungslink"
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
                {copied ? "Kopiert" : "Link kopieren"}
              </Button>
              <Button onClick={onClose} variant="primary">
                Fertig
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit((input) => mutation.mutate(input))}>
            <Field className="invitation-role">
              <FieldLabel htmlFor="invitation-role">Rolle</FieldLabel>
              <Select id="invitation-role" {...register("role")}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </Select>
            </Field>
            {mutation.isError ? (
              <FieldError>
                Der Einladungslink konnte nicht erstellt werden.
              </FieldError>
            ) : null}
            <DialogFooter>
              <Button onClick={onClose}>
                Abbrechen
              </Button>
              <Button
                disabled={mutation.isPending}
                type="submit"
                variant="primary"
              >
                Link erstellen
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogBody>
    </Dialog>
  );
}
