export const HOST_TOKEN_TYP = "embody-host";
export const HOST_TOKEN_TTL_SEC = 20 * 60;

export const HOST_FRAME_ANCESTORS =
  "'self' https://interfaze.io https://*.interfaze.io http://localhost:3010 http://127.0.0.1:3010";

export function isHostParentOrigin(origin: string, selfOrigin?: string): boolean {
  if (!origin) return false;
  if (selfOrigin && origin === selfOrigin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "interfaze.io" || url.hostname.endsWith(".interfaze.io")) {
      return true;
    }
    if (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === "3010"
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isHostPath(pathname: string | null | undefined): boolean {
  return Boolean(pathname && /\/b\/[^/]+\/host\/?$/.test(pathname));
}

export function readHostTokenFromHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  return new URLSearchParams(raw).get("th")?.trim() ?? "";
}

export function hostPath(bodyId: string): string {
  return `/b/${encodeURIComponent(bodyId)}/host`;
}

export function hostCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
