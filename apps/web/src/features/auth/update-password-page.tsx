import { zodResolver } from "@hookform/resolvers/zod";
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { z } from "zod";

import { Button, Input } from "../../components/ui";
import { useAuth } from "./auth-context";

function createPasswordSchema(t: TFunction<"auth">) {
  return z
    .object({
      password: z.string().min(12, t("updatePassword.passwordTooShort")),
      confirmation: z.string(),
    })
    .refine(({ password, confirmation }) => password === confirmation, {
      path: ["confirmation"],
      message: t("updatePassword.passwordsMismatch"),
    });
}

type PasswordUpdate = z.infer<ReturnType<typeof createPasswordSchema>>;

export function UpdatePasswordPage() {
  const { t } = useTranslation("auth");
  const schema = useMemo(() => createPasswordSchema(t), [t]);
  const { client } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  const { register, handleSubmit, formState } = useForm<PasswordUpdate>({
    resolver: zodResolver(schema),
  });

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-mark">{"{ }"}</span>
        <h1>{t("updatePassword.title")}</h1>
        <p>{t("updatePassword.subtitle")}</p>
        <form
          onSubmit={handleSubmit(async ({ password }) => {
            if (!client) return;
            const { error } = await client.auth.updateUser({ password });
            if (error) {
              setMessage(t("updatePassword.updateFailed"));
              return;
            }
            navigate("/", { replace: true });
          })}
        >
          <label htmlFor="new-password">
            {t("updatePassword.newPasswordLabel")}
          </label>
          <Input
            autoComplete="new-password"
            className="login-password"
            id="new-password"
            type="password"
            {...register("password")}
          />
          {formState.errors.password ? (
            <p className="field-error">{formState.errors.password.message}</p>
          ) : null}
          <label htmlFor="password-confirmation">
            {t("updatePassword.confirmationLabel")}
          </label>
          <Input
            autoComplete="new-password"
            className="login-password"
            id="password-confirmation"
            type="password"
            {...register("confirmation")}
          />
          {formState.errors.confirmation ? (
            <p className="field-error">
              {formState.errors.confirmation.message}
            </p>
          ) : null}
          <Button className="login-submit" type="submit" variant="primary">
            {t("updatePassword.save")}
          </Button>
        </form>
        {message ? <p className="login-message" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
