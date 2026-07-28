import { Braces, CircleUserRound, Settings } from "lucide-react";
import { Outlet } from "react-router";

export function RootLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Relay Startseite">
          <span className="brand-mark">
            <Braces aria-hidden="true" size={20} />
          </span>
          <span>Relay</span>
        </a>
        <div className="topbar-actions">
          <button className="icon-button" type="button" aria-label="Einstellungen">
            <Settings aria-hidden="true" size={18} />
          </button>
          <button className="profile-button" type="button">
            <CircleUserRound aria-hidden="true" size={20} />
            <span>Demo-Team</span>
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

