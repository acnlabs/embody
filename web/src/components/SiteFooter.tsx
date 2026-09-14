"use client";

import { useI18n } from "@/lib/i18n";

export default function SiteFooter() {
  const { t } = useI18n();
  return <footer>{t("footer")}</footer>;
}
