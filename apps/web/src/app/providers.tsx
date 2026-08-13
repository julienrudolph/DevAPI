import { FluentProvider } from "@fluentui/react-components";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";

import { AuthProvider } from "../features/auth/auth-context";
import { relayDarkTheme, relayTheme } from "./theme";
import { ThemeModeProvider, useThemeMode } from "./theme-mode";

function ThemedFluentProvider({ children }: PropsWithChildren) {
  const { resolvedMode } = useThemeMode();
  return (
    <FluentProvider
      className="fluent-app-root"
      theme={resolvedMode === "dark" ? relayDarkTheme : relayTheme}
    >
      {children}
    </FluentProvider>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <ThemeModeProvider>
      <ThemedFluentProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      </ThemedFluentProvider>
    </ThemeModeProvider>
  );
}
