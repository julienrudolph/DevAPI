import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { Button, Field, FieldError, FieldLabel, Input } from "../../components/ui";
import { AccountDeletionError } from "./account-api";
import { useAuth } from "./auth-context";
import { useAccountDeletionCheck, useDeleteAccount } from "./account-queries";

export function AccountSettingsPage() {
  const { t } = useTranslation("auth");
  const { client, user } = useAuth();
  const navigate = useNavigate();
  const deletionCheck = useAccountDeletionCheck();
  const deleteAccount = useDeleteAccount();
  const [confirmEmail, setConfirmEmail] = useState("");
  const [blockingTeams, setBlockingTeams] = useState<
    { id: string; name: string }[] | null
  >(null);

  const blockedByCheck =
    deletionCheck.isSuccess && deletionCheck.data.length > 0
      ? deletionCheck.data
      : null;
  const blocking = blockingTeams ?? blockedByCheck;

  async function handleDelete() {
    if (!user?.email) return;
    if (!window.confirm(t("account.deleteConfirmPrompt"))) return;
    try {
      await deleteAccount.mutateAsync({ confirmEmail });
      await client?.auth.signOut();
      navigate("/login", { replace: true });
    } catch (error) {
      if (error instanceof AccountDeletionError && error.code === "SOLE_OWNER_OF_TEAMS") {
        setBlockingTeams(error.blockingTeams);
      }
    }
  }

  const emailMatches =
    confirmEmail.trim().toLowerCase() === (user?.email ?? "").toLowerCase();

  return (
    <section className="settings-page">
      <div className="settings-card">
        <h1>{t("account.title")}</h1>
        <p className="settings-email">{user?.email}</p>

        <div className="settings-danger-zone">
          <h2>{t("account.deleteTitle")}</h2>
          <p>{t("account.deleteDescription")}</p>

          {deletionCheck.isPending ? (
            <p className="dialog-state">{t("account.deleteCheckLoading")}</p>
          ) : blocking && blocking.length > 0 ? (
            <div className="field-error" role="alert">
              <p>{t("account.deleteBlocked")}</p>
              <ul>
                {blocking.map((team) => (
                  <li key={team.id}>{team.name}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="confirm-email">
                  {t("account.deleteConfirmLabel", { email: user?.email })}
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id="confirm-email"
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  type="email"
                  value={confirmEmail}
                />
              </Field>
              {deleteAccount.isError &&
              !(
                deleteAccount.error instanceof AccountDeletionError &&
                deleteAccount.error.code === "SOLE_OWNER_OF_TEAMS"
              ) ? (
                <FieldError>{t("account.deleteError")}</FieldError>
              ) : null}
              <Button
                disabled={!emailMatches || deleteAccount.isPending}
                onClick={handleDelete}
                variant="danger"
              >
                {t("account.deleteAction")}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
