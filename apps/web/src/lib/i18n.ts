import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../locales/de/common.json";
import deAuth from "../locales/de/auth.json";
import deEnvironments from "../locales/de/environments.json";
import deHistory from "../locales/de/history.json";
import deImport from "../locales/de/import.json";
import deRequests from "../locales/de/requests.json";
import deRevisions from "../locales/de/revisions.json";
import deTeams from "../locales/de/teams.json";
import deWorkspaces from "../locales/de/workspaces.json";
import en from "../locales/en/common.json";
import enAuth from "../locales/en/auth.json";
import enEnvironments from "../locales/en/environments.json";
import enHistory from "../locales/en/history.json";
import enImport from "../locales/en/import.json";
import enRequests from "../locales/en/requests.json";
import enRevisions from "../locales/en/revisions.json";
import enTeams from "../locales/en/teams.json";
import enWorkspaces from "../locales/en/workspaces.json";

export const supportedLanguages = ["de", "en"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNativeNames: Record<SupportedLanguage, string> = {
  de: "Deutsch",
  en: "English",
};

export const defaultLanguage: SupportedLanguage = "de";

const STORAGE_KEY = "devapi:language";

export function isSupportedLanguage(
  value: string | null | undefined,
): value is SupportedLanguage {
  return (supportedLanguages as readonly string[]).includes(value ?? "");
}

export function detectLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return defaultLanguage;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isSupportedLanguage(stored)) return stored;
  const browserLanguage = window.navigator.language.slice(0, 2);
  return isSupportedLanguage(browserLanguage) ? browserLanguage : defaultLanguage;
}

export function persistLanguage(language: SupportedLanguage): void {
  window.localStorage.setItem(STORAGE_KEY, language);
}

export function initI18n(): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        de: {
          common: de,
          requests: deRequests,
          workspaces: deWorkspaces,
          environments: deEnvironments,
          teams: deTeams,
          auth: deAuth,
          revisions: deRevisions,
          history: deHistory,
          import: deImport,
        },
        en: {
          common: en,
          requests: enRequests,
          workspaces: enWorkspaces,
          environments: enEnvironments,
          teams: enTeams,
          auth: enAuth,
          revisions: enRevisions,
          history: enHistory,
          import: enImport,
        },
      },
      ns: [
        "common",
        "requests",
        "workspaces",
        "environments",
        "teams",
        "auth",
        "revisions",
        "history",
        "import",
      ],
      lng: detectLanguage(),
      fallbackLng: defaultLanguage,
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });

    i18n.on("languageChanged", (language) => {
      if (typeof document !== "undefined") {
        document.documentElement.lang = language;
      }
    });
  }
  return i18n;
}

export default i18n;
