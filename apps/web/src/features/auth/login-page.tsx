import { zodResolver } from "@hookform/resolvers/zod";
import type { Provider } from "@supabase/supabase-js";
import { Building2, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation } from "react-router";
import { z } from "zod";

import { Button, Input } from "../../components/ui";
import { useAuth } from "./auth-context";
import { DesktopServerSetup } from "./desktop-server-setup";

const credentialSchema = z.object({
  email: z.string().trim().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  password: z
    .string()
    .min(1, "Bitte gib dein Passwort ein.")
    .max(128, "Das Passwort ist zu lang."),
});
type Credentials = z.infer<typeof credentialSchema>;

export function LoginPage() {
  const { client, configurationError, env, user } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const { formState, getValues, handleSubmit, register, setError, trigger } =
    useForm<Credentials>({
    resolver: zodResolver(credentialSchema),
    defaultValues: { email: "", password: "" },
  });
  const from =
    typeof location.state === "object" &&
    location.state !== null &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";
  const redirectTo = window.devapiDesktop
    ? "devapi://auth/callback"
    : new URL(from, window.location.origin).toString();

  if (user) {
    return <Navigate replace to={from} />;
  }
  if (configurationError) {
    return <DesktopServerSetup />;
  }

  async function sendMagicLink() {
    if (!client) return;
    const validEmail = await trigger("email");
    if (!validEmail) return;
    setSubmitting(true);
    const { error } = await client.auth.signInWithOtp({
      email: getValues("email"),
      options: { emailRedirectTo: redirectTo },
    });
    setSubmitting(false);
    setMessage(
      error
        ? "Der Anmeldelink konnte nicht versendet werden."
        : "Prüfe dein Postfach und öffne den Anmeldelink.",
    );
  }

  async function submitCredentials({ email, password }: Credentials) {
    if (!client || !env?.passwordAuthEnabled) return;
    setMessage(undefined);
    if (mode === "signup" && password.length < 12) {
      setError("password", {
        message: "Für neue Konten muss das Passwort mindestens 12 Zeichen haben.",
      });
      return;
    }
    setSubmitting(true);
    const { data, error } =
      mode === "signup"
        ? await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo },
          })
        : await client.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setMessage(
        mode === "signup"
          ? "Das Konto konnte nicht erstellt werden."
          : "E-Mail-Adresse oder Passwort ist nicht korrekt.",
      );
      return;
    }
    if (mode === "signup" && !data.session) {
      setMessage(
        "Das Konto wurde erstellt. Dieser Server verlangt vor der Anmeldung eine E-Mail-Bestätigung.",
      );
    }
  }

  async function resetPassword() {
    if (!client) return;
    const validEmail = await trigger("email");
    if (!validEmail) return;
    setSubmitting(true);
    const redirectTo = window.devapiDesktop
      ? "devapi://auth/callback?next=password-reset"
      : new URL("/auth/confirm?next=/auth/password", window.location.origin)
          .toString();
    const { error } = await client.auth.resetPasswordForEmail(
      getValues("email"),
      { redirectTo },
    );
    setSubmitting(false);
    setMessage(
      error
        ? "Die Wiederherstellungs-E-Mail konnte nicht versendet werden. Prüfe, ob SMTP auf dem Server eingerichtet ist."
        : "Prüfe dein Postfach, um ein neues Passwort festzulegen.",
    );
  }

  async function signInWithOidc() {
    if (!client || !env?.oidcProvider) return;
    setSubmitting(true);
    // Supabase unterstützt `custom:*` zur Laufzeit; der veröffentlichte
    // Provider-Union-Type enthält die neue Custom-OIDC-Form noch nicht.
    const provider = env.oidcProvider as Provider;
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: Boolean(window.devapiDesktop),
      },
    });
    if (!error && data.url && window.devapiDesktop?.openAuthUrl) {
      try {
        await window.devapiDesktop.openAuthUrl(data.url);
        setSubmitting(false);
        setMessage(
          "Die Anmeldung wurde im Systembrowser geöffnet. Kehre danach zu Relay zurück.",
        );
      } catch {
        setSubmitting(false);
        setMessage("Der Systembrowser konnte nicht sicher geöffnet werden.");
      }
    }
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
            <Button
              className="oidc-button"
              disabled={submitting}
              onClick={signInWithOidc}
            >
              <Building2 aria-hidden="true" size={17} />
              {env.oidcLabel ?? "Mit Firmenkonto anmelden"}
            </Button>
            <div className="login-divider">
              <span>oder</span>
            </div>
          </>
        ) : null}

        {env?.passwordAuthEnabled && env.passwordSignupEnabled ? (
          <div className="auth-mode-switch" role="group" aria-label="Anmeldemodus">
            <Button
              aria-pressed={mode === "signin"}
              className={mode === "signin" ? "active" : undefined}
              onClick={() => {
                setMode("signin");
                setMessage(undefined);
              }}
              variant="ghost"
            >
              Anmelden
            </Button>
            <Button
              aria-pressed={mode === "signup"}
              className={mode === "signup" ? "active" : undefined}
              onClick={() => {
                setMode("signup");
                setMessage(undefined);
              }}
              variant="ghost"
            >
              Registrieren
            </Button>
          </div>
        ) : null}

        {env?.passwordAuthEnabled || env?.magicLinkAuthEnabled ? (
        <form onSubmit={handleSubmit(submitCredentials)}>
          <label htmlFor="email">E-Mail-Adresse</label>
            <Input
              autoComplete="email"
              className="login-input"
              contentBefore={<Mail aria-hidden="true" size={17} />}
              id="email"
              placeholder="name@unternehmen.de"
              type="email"
              {...register("email")}
            />
          {formState.errors.email ? (
            <p className="field-error">{formState.errors.email.message}</p>
          ) : null}
          {env?.passwordAuthEnabled ? (
            <>
              <label htmlFor="password">Passwort</label>
              <Input
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                className="login-password"
                id="password"
                type="password"
                {...register("password")}
              />
              {formState.errors.password ? (
                <p className="field-error">
                  {formState.errors.password.message}
                </p>
              ) : null}
              <Button
                className="login-submit"
                disabled={submitting || configurationError}
                type="submit"
                variant="primary"
              >
                {mode === "signup" ? "Konto erstellen" : "Anmelden"}
              </Button>
              {mode === "signin" ? (
                <button
                  className="revision-link login-forgot-password"
                  disabled={submitting}
                  onClick={() => void resetPassword()}
                  type="button"
                >
                  Passwort vergessen?
                </button>
              ) : null}
            </>
          ) : null}
          {env?.magicLinkAuthEnabled && mode === "signin" ? (
            <Button
              className="login-submit"
              disabled={submitting || configurationError}
              onClick={() => void sendMagicLink()}
              variant={env.passwordAuthEnabled ? "secondary" : "primary"}
            >
              Anmeldelink senden
            </Button>
          ) : null}
        </form>
        ) : null}
        {message ? <p className="login-message" role="status">{message}</p> : null}
      </section>
    </main>
  );
}
