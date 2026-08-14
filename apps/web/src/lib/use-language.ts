import { useTranslation } from "react-i18next";

import {
  defaultLanguage,
  isSupportedLanguage,
  persistLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "./i18n";

export function useLanguage(): {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  supportedLanguages: readonly SupportedLanguage[];
} {
  const { i18n } = useTranslation();
  const language = isSupportedLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : defaultLanguage;

  function setLanguage(next: SupportedLanguage) {
    void i18n.changeLanguage(next);
    persistLanguage(next);
  }

  return { language, setLanguage, supportedLanguages };
}
