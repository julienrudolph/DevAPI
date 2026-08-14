import { afterEach, describe, expect, it, vi } from "vitest";

import { detectLanguage, isSupportedLanguage, persistLanguage } from "./i18n";

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("isSupportedLanguage", () => {
  it("only accepts languages with shipped translations", () => {
    expect(isSupportedLanguage("de")).toBe(true);
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("fr")).toBe(false);
    expect(isSupportedLanguage(null)).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
  });
});

describe("detectLanguage", () => {
  it("prefers a persisted preference over the browser language", () => {
    window.localStorage.setItem("devapi:language", "en");
    expect(detectLanguage()).toBe("en");
  });

  it("falls back to a supported browser language when nothing is stored", () => {
    vi.stubGlobal("navigator", { language: "en-GB" });
    expect(detectLanguage()).toBe("en");
  });

  it("falls back to the default language when the browser language is unsupported", () => {
    vi.stubGlobal("navigator", { language: "fr-FR" });
    expect(detectLanguage()).toBe("de");
  });
});

describe("persistLanguage", () => {
  it("stores the chosen language for the next session", () => {
    persistLanguage("en");
    expect(window.localStorage.getItem("devapi:language")).toBe("en");
  });
});
