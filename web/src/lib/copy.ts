/** Owner-facing helpers. Words live in lib/i18n; this file stays usable on the server. */

import type { Translate } from "@/lib/i18n/types";
import type { ControlEvent } from "@/lib/control";

export function agentLabel(body: { bound_agent_id: string; bound_agent_name?: string }): string {
  const name = (body.bound_agent_name || "").trim();
  const id = body.bound_agent_id;
  if (name && name !== id) return name;
  return id.slice(0, 8);
}

export function trickLabel(alias: string): string {
  const text = alias.replace(/_/g, " ").trim();
  return text || alias;
}

export function originLabel(origin: string, t: Translate): string {
  if (origin === "robot") return t("origin.robot");
  if (origin === "sim") return t("origin.sim");
  return origin;
}

export function sessionLabel(running: boolean | undefined, t: Translate): string {
  return running ? t("session.on") : t("session.off");
}

export function bodyIsLive(body: {
  session_running?: boolean;
  drive_listening?: boolean;
}): boolean {
  return Boolean(body.session_running && body.drive_listening);
}

export function cardModeLabel(mode: string | undefined, t: Translate): string | null {
  if (mode === "perpetual") return t("cards.gait");
  if (mode === "episodic") return t("cards.trick");
  return mode || null;
}

export function controlWhat(event: ControlEvent, t: Translate): string {
  const name = event.alias || "—";
  if (event.op === "start") return t("control.start", { name });
  if (event.op === "stop") return t("control.stop");
  if (event.op === "pull") return t("control.pull", { name });
  if (event.op === "twist") return t("control.twist");
  if (event.op === "halt") return t("control.halt");
  if (event.op === "do") return t("control.do", { name });
  return event.op;
}

export function twistHint(event: ControlEvent): string | null {
  if (event.op !== "twist") return null;
  const x = event.x ?? 0;
  const y = event.y ?? 0;
  const yaw = event.yaw ?? 0;
  return `${x.toFixed(2)} · ${y.toFixed(2)} · ${yaw.toFixed(2)}`;
}

export function buildKeyLabel(key: string, t: Translate): string {
  const path = `build.${key}`;
  const out = t(path);
  return out === path ? key : out;
}

export const OWNER_ERR = {
  login: "Please sign in",
  missing: "This body was not found",
  forbidden: "This is not your body",
  down: "Can't open this right now",
} as const;

export type OwnerErrorKind = "signIn" | "notFound" | "forbidden" | "down" | "load" | "drive";

export function ownerErrorKind(raw: string): OwnerErrorKind | null {
  if (/token required|Auth0 token|unauthorized|Please sign in|请先登录/i.test(raw)) return "signIn";
  if (/my-agents|Can't open this right now|暂时打不开/i.test(raw)) return "down";
  if (/not pushed|unknown body|was not found|找不到/i.test(raw)) return "notFound";
  if (/不属于|does not match|not your body|这不是你的/i.test(raw)) return "forbidden";
  if (/load failed|Failed to fetch|NetworkError|Couldn't load|加载失败/i.test(raw)) return "load";
  if (/drive failed|need twist|do alias|JSON body|Can't drive|现在开不了/i.test(raw)) return "drive";
  return null;
}

export function ownerError(raw: string, t?: Translate): string {
  const kind = ownerErrorKind(raw);
  if (kind && t) return t(`error.${kind}`);
  if (kind === "signIn") return OWNER_ERR.login + ".";
  if (kind === "notFound") return OWNER_ERR.missing + ".";
  if (kind === "forbidden") return OWNER_ERR.forbidden + ".";
  if (kind === "down") return OWNER_ERR.down + ".";
  if (kind === "load") return "Couldn't load.";
  if (kind === "drive") return "Can't drive right now.";
  return raw;
}
