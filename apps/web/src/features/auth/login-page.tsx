import { zodResolver } from "@hookform/resolvers/zod";
import type { Provider } from "@supabase/supabase-js";
import type { TFunction } from "i18next";
import { Building2, Mail } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router";
import { z } from "zod";

import { Button, Input } from "../../components/ui";
import { useAuth } from "./auth-context";
import { DesktopServerSetup } from "./desktop-server-setup";

function createCredentialSchema(t: TFunction<"auth">) {
  return z.object({
    email: z.string().trim().email(t("login.emailInvalid")),
    password: z
      .string()
      .min(1, t("login.passwordRequired"))
      .max(128, t("login.passwordTooLong")),
  });
}
type Credentials = z.infer<ReturnType<typeof createCredentialSchema>>;

export function LoginPage() {
  const { t } = useTranslation("auth");
  const credentialSchema = useMemo(() => createCredentialSchema(t), [t]);
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
      error ? t("login.magicLinkSendFailed") : t("login.magicLinkSent"),
    );
  }

  async function submitCredentials({ email, password }: Credentials) {
    if (!client || !env?.passwordAuthEnabled) return;
    setMessage(undefined);
    if (mode === "signup" && password.length < 12) {
      setError("password", {
        message: t("login.signupPasswordTooShort"),
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
        mode === "signup" ? t("login.signupFailed") : t("login.signinFailed"),
      );
      return;
    }
    if (mode === "signup" && !data.session) {
      setMessage(t("login.signupConfirmationRequired"));
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
      error ? t("login.resetEmailFailed") : t("login.resetEmailSent"),
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
        setMessage(t("login.oidcBrowserOpened"));
      } catch {
        setSubmitting(false);
        setMessage(t("login.oidcBrowserFailed"));
      }
    }
    if (error) {
      setSubmitting(false);
      setMessage(t("login.oidcStartFailed"));
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-mark">{"{ }"}</span>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>

        {env?.oidcProvider ? (
          <>
            <Button
              className="oidc-button"
              disabled={submitting}
              onClick={signInWithOidc}
            >
              <Building2 aria-hidden="true" size={17} />
              {env.oidcLabel ?? t("login.oidcButtonFallback")}
            </Button>
            <div className="login-divider">
              <span>{t("login.or")}</span>
            </div>
          </>
        ) : null}

        {env?.passwordAuthEnabled && env.passwordSignupEnabled ? (
          <div
            className="auth-mode-switch"
            role="group"
            aria-label={t("login.modeGroupLabel")}
          >
            <Button
              aria-pressed={mode === "signin"}
              className={mode === "signin" ? "active" : undefined}
              onClick={() => {
                setMode("signin");
                setMessage(undefined);
              }}
              variant="ghost"
            >
              {t("login.signIn")}
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
              {t("login.signUp")}
            </Button>
          </div>
        ) : null}

        {env?.passwordAuthEnabled || env?.magicLinkAuthEnabled ? (
        <form onSubmit={handleSubmit(submitCredentials)}>
          <label htmlFor="email">{t("login.emailLabel")}</label>
            <Input
              autoComplete="email"
              className="login-input"
              contentBefore={<Mail aria-hidden="true" size={17} />}
              id="email"
              placeholder={t("login.emailPlaceholder")}
              type="email"
              {...register("email")}
            />
          {formState.errors.email ? (
            <p className="field-error">{formState.errors.email.message}</p>
          ) : null}
          {env?.passwordAuthEnabled ? (
            <>
              <label htmlFor="password">{t("login.passwordLabel")}</label>
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
                {mode === "signup"
                  ? t("login.createAccount")
                  : t("login.signIn")}
              </Button>
              {mode === "signin" ? (
                <Button
                  className="revision-link login-forgot-password"
                  disabled={submitting}
                  onClick={() => void resetPassword()}
                  size="small"
                  variant="ghost"
                >
                  {t("login.forgotPassword")}
                </Button>
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
              {t("login.sendMagicLink")}
            </Button>
          ) : null}
        </form>
        ) : null}
        {message ? <p className="login-message" role="status">{message}</p> : null}
      </section>
    </main>
  );
}
