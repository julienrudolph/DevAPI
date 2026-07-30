import { zodResolver } from "@hookform/resolvers/zod";
import type { Provider } from "@supabase/supabase-js";
import { Building2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router";
import { z } from "zod";

import { useAuth } from "./auth-context";
import { DesktopServerSetup } from "./desktop-server-setup";

const emailLoginSchema = z.object({
  email: z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse ein."),
});
type EmailLogin = z.infer<typeof emailLoginSchema>;

export function LoginPage() {
  const { client, configurationError, env, user } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const { formState, handleSubmit, register } = useForm<EmailLogin>({
    resolver: zodResolver(emailLoginSchema),
  });
  const from =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";
  const redirectTo = new URL(from, window.location.origin).toString();

  if (user) {
    return <Navigate replace to={from} />;
  }
  if (configurationError) {
    return <DesktopServerSetup />;
  }

  async function signInWithEmail({ email }: EmailLogin) {
    if (!client) return;
    setSubmitting(true);
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting(false);
    setMessage(
      error
        ? "Der Anmeldelink konnte nicht versendet werden."
        : "Prüfe dein Postfach und öffne den Anmeldelink.",
    );
  }

  async function signInWithOidc() {
    if (!client || !env?.oidcProvider) return;
    setSubmitting(true);
    // Supabase unterstützt `custom:*` zur Laufzeit; der veröffentlichte
    // Provider-Union-Type enthält die neue Custom-OIDC-Form noch nicht.
    const provider = env.oidcProvider as Provider;
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setSubmitting(false);
      setMessage("Die OIDC-Anmeldung konnte nicht gestartet werden.");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-mark">{"{ }"}</span>
        <h1>Bei Relay anmelden</h1>
        <p>Öffne die gemeinsamen API-Workspaces deines Teams.</p>

        {env?.oidcProvider ? (
          <>
            <button
              className="button oidc-button"
              disabled={submitting}
              onClick={signInWithOidc}
              type="button"
            >
              <Building2 aria-hidden="true" size={17} />
              {env.oidcLabel ?? "Mit Firmenkonto anmelden"}
            </button>
            <div className="login-divider">
              <span>oder</span>
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit(signInWithEmail)}>
          <label htmlFor="email">E-Mail-Adresse</label>
          <div className="login-input">
            <Mail aria-hidden="true" size={17} />
            <input
              autoComplete="email"
              id="email"
              placeholder="name@unternehmen.de"
              type="email"
              {...register("email")}
            />
          </div>
          {formState.errors.email ? (
            <p className="field-error">{formState.errors.email.message}</p>
          ) : null}
          <button
            className="button primary login-submit"
            disabled={submitting || configurationError}
            type="submit"
          >
            Anmeldelink senden
          </button>
        </form>
        {message ? <p className="login-message" role="status">{message}</p> : null}
      </section>
    </main>
  );
}
