import { ServerCog } from "lucide-react";
import { useEffect, useState } from "react";

import { Button, Input } from "../../components/ui";

export function DesktopServerSetup() {
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
        <h1>Authentifizierung nicht konfiguriert</h1>
        <p>
          Der Server stellt keine gültige öffentliche Clientkonfiguration
          bereit.
        </p>
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
              setError(
                "Der Server konnte nicht übernommen werden. Prüfe HTTPS-Adresse und Erreichbarkeit.",
              );
            });
        }}
      >
        <span className="login-mark">
          <ServerCog aria-hidden="true" size={22} />
        </span>
        <h1>DevAPI-Server verbinden</h1>
        <p>
          Die Desktop-App lädt Teams und Requests von deinem zentralen
          DevAPI-Server.
        </p>
        <label htmlFor="desktop-server-url">Serveradresse</label>
        <Input
          autoFocus
          id="desktop-server-url"
          onChange={(event) => setServerUrl(event.target.value)}
          placeholder="https://devapi.example.de"
          required
          type="url"
          value={serverUrl}
        />
        <p className="security-hint">
          Installierte Versionen akzeptieren ausschließlich HTTPS. Zugangsdaten
          gehören nicht in die URL.
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
          {saving ? "Verbindung wird gespeichert …" : "Mit Server verbinden"}
        </Button>
      </form>
    </main>
  );
}
