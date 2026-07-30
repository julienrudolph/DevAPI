import { zodResolver } from "@hookform/resolvers/zod";
import {
  createTeamInvitationSchema,
  type CreateTeamInvitation,
} from "@api-client/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="invitation-title"
        aria-modal="true"
        className="conflict-dialog"
        role="dialog"
      >
        <h2 id="invitation-title">Teammitglied einladen</h2>
        {invitationUrl ? (
          <>
            <p>
              Dieser Link ist sieben Tage gültig und kann einmal angenommen
              werden. Der Token wird serverseitig nur gehasht gespeichert.
            </p>
            <input
              aria-label="Einladungslink"
              className="invitation-link"
              readOnly
              value={invitationUrl}
            />
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(invitationUrl)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
                type="button"
              >
                {copied ? "Kopiert" : "Link kopieren"}
              </button>
              <button className="button primary" onClick={onClose} type="button">
                Fertig
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
          >
            <label className="invitation-role">
              Rolle
              <select {...register("role")}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            {mutation.isError ? (
              <p className="field-error">
                Der Einladungslink konnte nicht erstellt werden.
              </p>
            ) : null}
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={onClose}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="button primary"
                disabled={mutation.isPending}
              >
                Link erstellen
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
