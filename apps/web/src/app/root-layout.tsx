import { PersonCircle20Regular } from "@fluentui/react-icons";
import { Braces, Monitor, Moon, Sun } from "lucide-react";
import { Outlet } from "react-router";

import { Button, IconButton, Tooltip } from "../components/ui";
import { useAuth } from "../features/auth/auth-context";
import { type ThemeMode, useThemeMode } from "./theme-mode";

const nextMode: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const modeLabel: Record<ThemeMode, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "System",
};

function ThemeModeToggle() {
  const { mode, setMode } = useThemeMode();
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <Tooltip
      content={`Design: ${modeLabel[mode]} (zu „${modeLabel[nextMode[mode]]}“ wechseln)`}
      relationship="description"
    >
      <IconButton
        aria-label={`Design wechseln, aktuell ${modeLabel[mode]}`}
        onClick={() => setMode(nextMode[mode])}
      >
        <Icon aria-hidden="true" size={18} />
      </IconButton>
    </Tooltip>
  );
}

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
          <ThemeModeToggle />
          <Tooltip
            content={`Als ${user?.email ?? "Nutzer"} abmelden`}
            relationship="description"
          >
            <Button
              className="profile-button"
              onClick={signOut}
              variant="ghost"
            >
              <PersonCircle20Regular aria-hidden="true" />
              <span>{user?.email ?? "Abmelden"}</span>
            </Button>
          </Tooltip>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
