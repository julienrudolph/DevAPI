import { ServerCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Input } from "../../components/ui";

export function DesktopServerSetup() {
  const { t } = useTranslation("auth");
  const bridge = window.devapiDesktop;
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getServerUrl().then((value) => {
      if (value) setServerUrl(value);
    });
  }, [bridge]);

  if (!bridge) {
    return (
      <main className="centered-state">
        <h1>{t("desktopServerSetup.notConfiguredTitle")}</h1>
        <p>{t("desktopServerSetup.notConfiguredDescription")}</p>
      </main>
    );
  }

  return (
    <main className="login-page">
      <form
        className="login-card desktop-server-card"
        onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setError(undefined);
          void bridge
            .setServerUrl(serverUrl)
            .catch(() => {
              setSaving(false);
              setError(t("desktopServerSetup.connectFailed"));
            });
        }}
      >
        <span className="login-mark">
          <ServerCog aria-hidden="true" size={22} />
        </span>
        <h1>{t("desktopServerSetup.title")}</h1>
        <p>{t("desktopServerSetup.description")}</p>
        <label htmlFor="desktop-server-url">
          {t("desktopServerSetup.serverAddressLabel")}
        </label>
        <Input
          autoFocus
          id="desktop-server-url"
          onChange={(event) => setServerUrl(event.target.value)}
          placeholder={t("desktopServerSetup.serverAddressPlaceholder")}
          required
          type="url"
          value={serverUrl}
        />
        <p className="security-hint">
          {t("desktopServerSetup.securityHint")}
        </p>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          className="login-submit"
          disabled={saving}
          type="submit"
          variant="primary"
        >
          {saving
            ? t("desktopServerSetup.saving")
            : t("desktopServerSetup.connect")}
        </Button>
      </form>
    </main>
  );
}
