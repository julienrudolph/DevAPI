import { Crown, Trash2, Users } from "lucide-react";

import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  FieldError,
  IconButton,
  Select,
  Tooltip,
} from "../../components/ui";
import { useAuth } from "../auth/auth-context";
import {
  useRemoveTeamMember,
  useTeamMembers,
  useTransferTeamOwnership,
  useUpdateTeamMember,
} from "./team-member-queries";

export function TeamMembersDialog({
  onClose,
  teamId,
}: {
  onClose: () => void;
  teamId: string;
}) {
  const { user } = useAuth();
  const members = useTeamMembers(teamId);
  const updateMember = useUpdateTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const transferOwnership = useTransferTeamOwnership(teamId);
  const busy =
    updateMember.isPending || removeMember.isPending ||
    transferOwnership.isPending;

  return (
    <Dialog
      className="team-members-dialog"
      descriptionId="team-members-description"
      onClose={onClose}
      titleId="team-members-title"
    >
      <DialogHeader>
        <span className="member-avatar">
          <Users aria-hidden="true" size={19} />
        </span>
        <div>
          <h2 id="team-members-title">Team verwalten</h2>
          <p id="team-members-description">
            Rollen gelten für alle Workspaces dieses Teams.
          </p>
        </div>
      </DialogHeader>

      <DialogBody>
        {members.isPending ? (
          <p className="dialog-state">Mitglieder werden geladen …</p>
        ) : members.isError ? (
          <p className="field-error">
            Die Mitglieder konnten nicht geladen werden.
          </p>
        ) : (
          <div className="team-member-list">
            {members.data.map((member) => (
              <div className="team-member-row" key={member.userId}>
                <span className="member-avatar">
                  {member.displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="member-identity">
                  <strong>{member.displayName}</strong>
                  <small>{member.email}</small>
                </span>
                {member.role === "owner" ? (
                  <span className="role-badge">Owner</span>
                ) : member.userId === user?.id ? (
                  <span className="role-badge">Du</span>
                ) : (
                  <>
                    <Select
                      aria-label={`Rolle von ${member.displayName}`}
                      disabled={busy}
                      onChange={(event) =>
                        updateMember.mutate({
                          userId: member.userId,
                          role: event.target.value as "editor" | "viewer",
                        })
                      }
                      value={member.role}
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <Tooltip
                      content={`Owner-Rechte an ${member.displayName} übertragen`}
                      relationship="description"
                    >
                      <IconButton
                        aria-label={`Owner-Rechte an ${member.displayName} übertragen`}
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Owner-Rechte wirklich an ${member.displayName} übertragen? ` +
                                "Du wirst danach selbst zum Editor.",
                            )
                          ) {
                            transferOwnership.mutate(member.userId);
                          }
                        }}
                      >
                        <Crown aria-hidden="true" size={16} />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      aria-label={`${member.displayName} entfernen`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${member.displayName} wirklich aus dem Team entfernen?`,
                          )
                        ) {
                          removeMember.mutate(member.userId);
                        }
                      }}
                      variant="danger"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </IconButton>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {updateMember.isError || removeMember.isError ||
        transferOwnership.isError ? (
          <FieldError>Die Änderung konnte nicht gespeichert werden.</FieldError>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="primary">
          Fertig
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
