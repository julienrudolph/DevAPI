import { Crown, Trash2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  usePendingInvitations,
  useRevokeInvitation,
} from "../invitations/invitation-queries";
import {
  useRemoveTeamMember,
  useTeamMembers,
  useTransferTeamOwnership,
  useUpdateTeamMember,
} from "./team-member-queries";

const dateFormatLocales: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
};

export function TeamMembersDialog({
  onClose,
  teamId,
}: {
  onClose: () => void;
  teamId: string;
}) {
  const { i18n, t } = useTranslation(["teams", "common"]);
  const { user } = useAuth();
  const members = useTeamMembers(teamId);
  const updateMember = useUpdateTeamMember(teamId);
  const removeMember = useRemoveTeamMember(teamId);
  const transferOwnership = useTransferTeamOwnership(teamId);
  const pendingInvitations = usePendingInvitations(teamId);
  const revokeInvitation = useRevokeInvitation(teamId);
  const busy =
    updateMember.isPending || removeMember.isPending ||
    transferOwnership.isPending;
  const dateFormatter = new Intl.DateTimeFormat(
    dateFormatLocales[i18n.language] ?? "en-US",
    { dateStyle: "medium" },
  );

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
          <h2 id="team-members-title">{t("members.title")}</h2>
          <p id="team-members-description">{t("members.description")}</p>
        </div>
      </DialogHeader>

      <DialogBody>
        {members.isPending ? (
          <p className="dialog-state">{t("members.loading")}</p>
        ) : members.isError ? (
          <p className="field-error">{t("members.loadError")}</p>
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
                  <span className="role-badge">{t("members.roleOwner")}</span>
                ) : member.userId === user?.id ? (
                  <span className="role-badge">{t("members.roleYou")}</span>
                ) : (
                  <>
                    <Select
                      aria-label={t("members.roleOf", {
                        name: member.displayName,
                      })}
                      disabled={busy}
                      onChange={(event) =>
                        updateMember.mutate({
                          userId: member.userId,
                          role: event.target.value as "editor" | "viewer",
                        })
                      }
                      value={member.role}
                    >
                      <option value="editor">{t("members.roleEditor")}</option>
                      <option value="viewer">{t("members.roleViewer")}</option>
                    </Select>
                    <Tooltip
                      content={t("members.transferOwnership", {
                        name: member.displayName,
                      })}
                      relationship="description"
                    >
                      <IconButton
                        aria-label={t("members.transferOwnership", {
                          name: member.displayName,
                        })}
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              t("members.transferOwnershipConfirm", {
                                name: member.displayName,
                              }),
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
                      aria-label={t("members.removeMember", {
                        name: member.displayName,
                      })}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            t("members.removeMemberConfirm", {
                              name: member.displayName,
                            }),
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
          <FieldError>{t("members.saveError")}</FieldError>
        ) : null}

        <h3 className="team-members-subheading">
          {t("members.pendingInvitationsTitle")}
        </h3>
        {pendingInvitations.isPending ? (
          <p className="dialog-state">{t("members.pendingLoading")}</p>
        ) : pendingInvitations.isError ? (
          <p className="field-error">{t("members.pendingLoadError")}</p>
        ) : pendingInvitations.data.length === 0 ? (
          <p className="dialog-state">{t("members.pendingEmpty")}</p>
        ) : (
          <div className="team-member-list">
            {pendingInvitations.data.map((invitation) => (
              <div className="team-member-row" key={invitation.id}>
                <span className="member-identity">
                  <strong>
                    {invitation.role === "editor"
                      ? t("members.roleEditor")
                      : t("members.roleViewer")}
                  </strong>
                  <small>
                    {t("members.pendingCreatedBy", {
                      name: invitation.createdBy.displayName,
                    })}{" "}
                    ·{" "}
                    {t("members.pendingExpires", {
                      date: dateFormatter.format(
                        new Date(invitation.expiresAt),
                      ),
                    })}
                  </small>
                </span>
                <IconButton
                  aria-label={t("members.revokeInvitation")}
                  disabled={revokeInvitation.isPending}
                  onClick={() => {
                    if (window.confirm(t("members.revokeInvitationConfirm"))) {
                      revokeInvitation.mutate(invitation.id);
                    }
                  }}
                  variant="danger"
                >
                  <Trash2 aria-hidden="true" size={16} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
        {revokeInvitation.isError ? (
          <FieldError>{t("members.revokeInvitationError")}</FieldError>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose} variant="primary">
          {t("actions.done", { ns: "common" })}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
