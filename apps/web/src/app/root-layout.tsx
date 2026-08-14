import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from "@fluentui/react-components";
import { PersonCircle20Regular } from "@fluentui/react-icons";
import { Braces, Languages, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";

import { Button, IconButton, Tooltip } from "../components/ui";
import { useAuth } from "../features/auth/auth-context";
import { languageNativeNames } from "../lib/i18n";
import { useLanguage } from "../lib/use-language";
import { type ThemeMode, useThemeMode } from "./theme-mode";

const nextMode: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

function ThemeModeToggle() {
  const { t } = useTranslation();
  const { mode, setMode } = useThemeMode();
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const modeLabel = t(`theme.${mode}`);
  const nextModeLabel = t(`theme.${nextMode[mode]}`);

  return (
    <Tooltip
      content={t("theme.toggleTooltip", {
        mode: modeLabel,
        nextMode: nextModeLabel,
      })}
      relationship="description"
    >
      <IconButton
        aria-label={t("theme.toggleAriaLabel", { mode: modeLabel })}
        onClick={() => setMode(nextMode[mode])}
      >
        <Icon aria-hidden="true" size={18} />
      </IconButton>
    </Tooltip>
  );
}

function LanguageSwitcher() {
  const { t } = useTranslation();
  const { language, setLanguage, supportedLanguages } = useLanguage();

  return (
    <Tooltip content={t("language.switchTooltip")} relationship="description">
      <Menu positioning="below-end">
        <MenuTrigger disableButtonEnhancement>
          <IconButton
            aria-label={t("language.switchAriaLabel", {
              language: languageNativeNames[language],
            })}
          >
            <Languages aria-hidden="true" size={18} />
          </IconButton>
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {supportedLanguages.map((candidate) => (
              <MenuItem
                key={candidate}
                onClick={() => setLanguage(candidate)}
              >
                {languageNativeNames[candidate]}
                {candidate === language ? " ✓" : ""}
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
    </Tooltip>
  );
}

export function RootLayout() {
  const { t } = useTranslation();
  const { client, user } = useAuth();

  async function signOut() {
    await client?.auth.signOut();
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("layout.skipToContent")}
      </a>
      <header className="topbar">
        <a className="brand" href="/" aria-label={`${t("app.name")} Startseite`}>
          <span className="brand-mark">
            <Braces aria-hidden="true" size={20} />
          </span>
          <span>{t("app.name")}</span>
        </a>
        <div className="topbar-actions">
          <LanguageSwitcher />
          <ThemeModeToggle />
          <Tooltip
            content={t("auth.signOutTooltip", {
              email: user?.email ?? t("auth.signOutFallback"),
            })}
            relationship="description"
          >
            <Button
              className="profile-button"
              onClick={signOut}
              variant="ghost"
            >
              <PersonCircle20Regular aria-hidden="true" />
              <span>{user?.email ?? t("auth.signOutFallback")}</span>
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
