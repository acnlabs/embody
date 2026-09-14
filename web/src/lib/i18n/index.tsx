"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { en, type Messages } from "./en";
import { zh } from "./zh";
import type { Translate } from "./types";

export type { Translate } from "./types";

export type Locale = "en" | "zh";
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALES: Locale[] = ["en", "zh"];

const COOKIE = "embody_locale";
const dict: Record<Locale, Messages> = { en, zh };

type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
};

const I18nContext = createContext<I18n | null>(null);

function lookup(messages: Messages, path: string): string {
  const parts = path.split(".");
  let cur: unknown = messages;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return path;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : path;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] == null ? `{${key}}` : String(vars[key]),
  );
}

export function makeT(locale: Locale): Translate {
  const messages = dict[locale] || en;
  return (path, vars) => interpolate(lookup(messages, path), vars);
}

function writeLocale(locale: Locale) {
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}

function readStoredLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(en|zh)`));
  if (match?.[1] === "en" || match?.[1] === "zh") return match[1];
  return null;
}

function detectLocale(): Locale {
  const stored = readStoredLocale();
  if (stored) return stored;
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
    return "zh";
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const next = detectLocale();
    setLocaleState(next);
    writeLocale(next);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocale(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({ locale, setLocale, t: makeT(locale) }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n needs LocaleProvider");
  return ctx;
}

export function formatAgo(iso: string | undefined, t: Translate): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return iso;
  const min = Math.floor(ms / 60000);
  if (min < 1) return t("time.justNow");
  if (min < 60) return t("time.minutes", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t("time.hours", { n: h });
  return t("time.days", { n: Math.floor(h / 24) });
}
