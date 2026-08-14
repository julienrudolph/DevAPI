import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useAuth } from "./auth-context";

interface AuthConfirmation {
  tokenHash: string;
  type: EmailOtpType;
}

export function readAuthConfirmation(
  params: URLSearchParams,
): AuthConfirmation | null {
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  if (!tokenHash || (type !== "email" && type !== "recovery")) return null;
  return { tokenHash, type };
}

export function AuthConfirmPage() {
  const { t } = useTranslation("auth");
  const { client } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(false);

  useEffect(() => {
    const confirmation = readAuthConfirmation(searchParams);
    window.history.replaceState(window.history.state, "", "/auth/confirm");

    if (!client || !confirmation) {
      setError(true);
      return;
    }

    let active = true;
    void client.auth
      .verifyOtp({
        token_hash: confirmation.tokenHash,
        type: confirmation.type,
      })
      .then(({ error: verificationError }) => {
        if (!active) return;
        if (verificationError) {
          setError(true);
          return;
        }
        navigate(
          confirmation.type === "recovery" ? "/auth/password" : "/",
          { replace: true },
        );
      });

    return () => {
      active = false;
    };
  }, [client, navigate, searchParams]);

  if (error) {
    return (
      <main className="centered-state">
        <h1>{t("confirm.invalidTitle")}</h1>
        <p>{t("confirm.invalidDescription")}</p>
        <Link className="button primary" to="/login">
          {t("confirm.requestNewLink")}
        </Link>
      </main>
    );
  }

  return <main className="centered-state">{t("confirm.completing")}</main>;
}
