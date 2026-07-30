import { Trash2, Users } from "lucide-react";

import {
  useRemoveTeamMember,
  useTeamMembers,
  useUpdateTeamMember,
} from "./team-member-queries";

export function TeamMembersDialog({
  onClose,
  teamId,
}: {
  onClose: () => void;
  teamId: string;
}) {
  const members = useTeamMembers(teamId);
  const updateMember = useUpdateTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const busy = updateMember.isPending || removeMember.isPending;

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="team-members-title"
        aria-modal="true"
        className="conflict-dialog team-members-dialog"
        role="dialog"
      >
        <div className="team-members-heading">
          <span className="member-avatar">
            <Users aria-hidden="true" size={19} />
          </span>
          <div>
            <h2 id="team-members-title">Team verwalten</h2>
            <p>Rollen gelten für alle Workspaces dieses Teams.</p>
          </div>
        </div>

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
                ) : (
                  <>
                    <select
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
                    </select>
                    <button
                      aria-label={`${member.displayName} entfernen`}
                      className="icon-button danger"
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
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {updateMember.isError || removeMember.isError ? (
          <p className="field-error">
            Die Änderung konnte nicht gespeichert werden.
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="button primary" onClick={onClose} type="button">
            Fertig
          </button>
        </div>
      </section>
    </div>
  );
}
