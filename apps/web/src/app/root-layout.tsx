import { Braces, CircleUserRound } from "lucide-react";
import { Outlet } from "react-router";

import { useAuth } from "../features/auth/auth-context";

export function RootLayout() {
  const { client, user } = useAuth();

  async function signOut() {
    await client?.auth.signOut();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Zum Hauptinhalt
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Relay Startseite">
          <span className="brand-mark">
            <Braces aria-hidden="true" size={20} />
          </span>
          <span>Relay</span>
        </a>
        <div className="topbar-actions">
          <button
            className="profile-button"
            onClick={signOut}
            title="Abmelden"
            type="button"
          >
            <CircleUserRound aria-hidden="true" size={20} />
            <span>{user?.email ?? "Abmelden"}</span>
          </button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
