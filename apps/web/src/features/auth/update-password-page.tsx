import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";

import { useAuth } from "./auth-context";

const schema = z
  .object({
    password: z.string().min(12, "Das Passwort muss mindestens 12 Zeichen haben."),
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ["confirmation"],
    message: "Die Passwörter stimmen nicht überein.",
  });

type PasswordUpdate = z.infer<typeof schema>;

export function UpdatePasswordPage() {
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
        <h1>Neues Passwort festlegen</h1>
        <p>Verwende mindestens zwölf Zeichen.</p>
        <form
          onSubmit={handleSubmit(async ({ password }) => {
            if (!client) return;
            const { error } = await client.auth.updateUser({ password });
            if (error) {
              setMessage("Das Passwort konnte nicht geändert werden.");
              return;
            }
            navigate("/", { replace: true });
          })}
        >
          <label htmlFor="new-password">Neues Passwort</label>
          <input
            autoComplete="new-password"
            className="login-password"
            id="new-password"
            type="password"
            {...register("password")}
          />
          {formState.errors.password ? (
            <p className="field-error">{formState.errors.password.message}</p>
          ) : null}
          <label htmlFor="password-confirmation">Passwort wiederholen</label>
          <input
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
          <button className="button primary login-submit" type="submit">
            Passwort speichern
          </button>
        </form>
        {message ? <p className="login-message" role="alert">{message}</p> : null}
      </section>
    </main>
  );
}
