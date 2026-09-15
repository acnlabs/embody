"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_AUDIENCE } from "@/lib/auth0";
import { WALLET_URL } from "@/lib/chatGateway";
import { useI18n } from "@/lib/i18n";

const REFRESH_SKEW_MS = 30_000;
const MIN_HEIGHT = 480;

type SessionPayload = {
  embedUrl?: string;
  chatId?: string;
  expiresAt?: string | null;
  expiresIn?: number | null;
  error?: string;
  code?: string;
};

function iframeOrigin(src: string): string {
  try {
    return new URL(src).origin;
  } catch {
    return "";
  }
}

function errorKey(code?: string): string {
  if (code === "UNAUTHORIZED" || code === "AUTH_TOKEN_FAILED") return "error.signIn";
  if (code === "insufficient_credits") return "interfaze.noCredits";
  if (code === "embed_origin_forbidden") return "interfaze.originForbidden";
  if (code === "chat_forbidden") return "interfaze.chatForbidden";
  if (
    code === "embed_token_invalid" ||
    code === "embed_scope_denied" ||
    code === "embed_chat_mismatch"
  ) {
    return "interfaze.tokenInvalid";
  }
  if (code === "UPSTREAM_ERROR" || code === "embed_metadata_invalid" || code === "embed_context_invalid") {
    return "interfaze.upstreamError";
  }
  return "interfaze.error";
}

export default function InterfazeChat({
  agentId,
  bodyId,
  onSession,
  fill = false,
}: {
  agentId: string;
  bodyId: string;
  onSession?: (session: { chatId: string }) => void;
  fill?: boolean;
}) {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const { t, locale } = useI18n();
  const [embedUrl, setEmbedUrl] = useState("");
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const refreshAt = useRef<number | null>(null);
  const onSessionRef = useRef(onSession);
  onSessionRef.current = onSession;

  const load = useCallback(async () => {
    if (!agentId || !bodyId) return;
    setLoading(true);
    setErrorCode(null);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: { audience: AUTH0_AUDIENCE },
      });
      const res = await fetch("/api/user/chat/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          bodyId,
          parentOrigin: window.location.origin,
          theme: "light",
        }),
      });
      const data = (await res.json().catch(() => null)) as SessionPayload | null;
      if (!res.ok || !data?.embedUrl) {
        setErrorCode(data?.code || "UPSTREAM_ERROR");
        setEmbedUrl("");
        return;
      }
      setEmbedUrl(data.embedUrl);
      if (data.chatId) onSessionRef.current?.({ chatId: data.chatId });
      const fromIn =
        typeof data.expiresIn === "number" ? Date.now() + data.expiresIn * 1000 : null;
      const fromAt = data.expiresAt ? Date.parse(data.expiresAt) : NaN;
      refreshAt.current =
        (fromIn ?? (Number.isFinite(fromAt) ? fromAt : Date.now() + 900_000)) - REFRESH_SKEW_MS;
    } catch {
      setErrorCode("AUTH_TOKEN_FAILED");
      setEmbedUrl("");
    } finally {
      setLoading(false);
    }
  }, [agentId, bodyId, getAccessTokenSilently]);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    void load();
  }, [isAuthenticated, isLoading, load, locale]);

  useEffect(() => {
    if (!embedUrl || refreshAt.current == null) return;
    const wait = Math.max(5_000, refreshAt.current - Date.now());
    const id = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(id);
  }, [embedUrl, load]);

  useEffect(() => {
    if (!embedUrl) return;
    const allowed = iframeOrigin(embedUrl);
    const onMessage = (e: MessageEvent) => {
      if (allowed && e.origin !== allowed) return;
      const payload = e.data as { type?: string; height?: number; code?: string } | null;
      if (!payload || typeof payload.type !== "string") return;
      if (payload.type === "interfaze:ready" || payload.type === "interfaze:resize") {
        if (!fill && typeof payload.height === "number" && payload.height > 0) {
          setHeight(Math.max(MIN_HEIGHT, payload.height));
        }
        return;
      }
      if (payload.type === "interfaze:error") {
        setErrorCode(payload.code || "interfaze.error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedUrl, fill]);

  if (isLoading) return null;
  if (!isAuthenticated) {
    return <p className="meta">{t("interfaze.needLogin")}</p>;
  }

  if (errorCode && !embedUrl) {
    const showTopUp = errorCode === "insufficient_credits";
    return (
      <div className="interfaze-error">
        <p>{t(errorKey(errorCode))}</p>
        {showTopUp ? (
          <a href={WALLET_URL} target="_blank" rel="noreferrer">
            {t("interfaze.topUp")}
          </a>
        ) : (
          <button type="button" onClick={() => void load()}>
            {t("interfaze.retry")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={fill ? "interfaze-fill" : undefined}>
      {loading && !embedUrl ? <p className="meta">{t("interfaze.loading")}</p> : null}
      {embedUrl ? (
        <iframe
          title={t("interfaze.title")}
          src={embedUrl}
          className={fill ? "interfaze-frame fill" : "interfaze-frame"}
          style={fill ? undefined : { height }}
          allow="clipboard-write"
        />
      ) : null}
    </div>
  );
}
