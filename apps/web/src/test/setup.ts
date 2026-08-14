import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import { initI18n } from "../lib/i18n";

// Pin the test environment to German so existing assertions against German
// UI text stay deterministic regardless of the host's navigator.language.
window.localStorage.setItem("devapi:language", "de");
initI18n();

Object.defineProperty(globalThis, "NodeFilter", {
  configurable: true,
  value: window.NodeFilter,
});

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
