"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps the app with next-themes. We toggle the `.dark` class on <html>
 * because globals.css defines its dark palette under `.dark`.
 *
 * defaultTheme="system" means we follow the OS preference until the user
 * picks one explicitly via /settings.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
