import { useNavigate, useParams } from "react-router";

import { Button } from "../../components/ui";
import { useAcceptInvitation } from "./invitation-queries";

export function InvitationAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const mutation = useAcceptInvitation();

  return (
    <section className="centered-state">
      <h1>Teameinladung annehmen</h1>
      <p>
        Nach der Annahme erscheinen die freigegebenen Workspaces automatisch
        in deiner Navigation.
      </p>
      {mutation.isError ? (
        <p className="field-error">
          Der Link ist ungültig, abgelaufen oder wurde bereits verwendet.
        </p>
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
        Einladung annehmen
      </Button>
    </section>
  );
}
