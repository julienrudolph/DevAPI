import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { Button } from "../../components/ui";
import { useAcceptInvitation } from "./invitation-queries";

export function InvitationAcceptPage() {
  const { t } = useTranslation("teams");
  const { token } = useParams();
  const navigate = useNavigate();
  const mutation = useAcceptInvitation();

  return (
    <section className="centered-state">
      <h1>{t("acceptPage.title")}</h1>
      <p>{t("acceptPage.description")}</p>
      {mutation.isError ? (
        <p className="field-error">{t("acceptPage.invalidLink")}</p>
      ) : null}
      <Button
        disabled={!token || mutation.isPending}
        onClick={() => {
          if (!token) return;
          void mutation
            .mutateAsync(token)
            .then(() => navigate("/", { replace: true }))
            .catch(() => undefined);
        }}
        variant="primary"
      >
        {t("acceptPage.accept")}
      </Button>
    </section>
  );
}
