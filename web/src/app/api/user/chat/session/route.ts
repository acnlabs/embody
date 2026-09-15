import { createEmbedSession } from "@/lib/chatGateway";
import { OWNER_ERR } from "@/lib/copy";
import { getBody } from "@/lib/ledger";
import { bareAgentId, fetchMyAgents } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

function parentOriginFrom(req: Request, bodyOrigin?: string): string | null {
  if (bodyOrigin) {
    try {
      return new URL(bodyOrigin).origin;
    } catch {
      return null;
    }
  }
  const header = req.headers.get("origin")?.trim();
  if (header) {
    try {
      return new URL(header).origin;
    } catch {
      return null;
    }
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return null;
  }
}

function localeFrom(req: Request): string | undefined {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|; )embody_locale=(en|zh)/);
  if (match?.[1]) return match[1];
  const accept = (req.headers.get("accept-language") || "").toLowerCase();
  if (accept.startsWith("zh")) return "zh";
  return "en";
}

export async function POST(req: Request) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    return Response.json({ ok: false, error: OWNER_ERR.login, code: "UNAUTHORIZED" }, { status: 401 });
  }
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return Response.json({ ok: false, error: OWNER_ERR.login, code: "UNAUTHORIZED" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "JSON body required", code: "bad_request" }, { status: 400 });
  }

  const bodyId = String(payload.bodyId ?? "").trim();
  const agentId = bareAgentId(String(payload.agentId ?? ""));
  if (!bodyId || !agentId) {
    return Response.json(
      { ok: false, error: "bodyId and agentId required", code: "bad_request" },
      { status: 400 },
    );
  }

  const body = await getBody(bodyId);
  if (!body) {
    return Response.json({ ok: false, error: OWNER_ERR.missing, code: "not_found" }, { status: 404 });
  }
  if (bareAgentId(body.bound_agent_id) !== agentId) {
    return Response.json({ ok: false, error: OWNER_ERR.forbidden, code: "forbidden" }, { status: 403 });
  }

  const mine = await fetchMyAgents(bearer);
  if (mine == null) {
    return Response.json({ ok: false, error: OWNER_ERR.down, code: "UPSTREAM_ERROR" }, { status: 502 });
  }
  if (!mine.some((row) => row.id === agentId)) {
    return Response.json({ ok: false, error: OWNER_ERR.forbidden, code: "forbidden" }, { status: 403 });
  }

  const parentOrigin = parentOriginFrom(
    req,
    typeof payload.parentOrigin === "string" ? payload.parentOrigin : undefined,
  );
  if (!parentOrigin) {
    return Response.json(
      { ok: false, error: "parent_origin is required", code: "bad_request" },
      { status: 400 },
    );
  }

  const theme: "dark" | "light" | "auto" =
    payload.theme === "dark" || payload.theme === "auto" ? payload.theme : "light";

  const result = await createEmbedSession(bearer, {
    agentId,
    parentOrigin,
    context: `body:${body.id}`,
    metadata: { bodyId: body.id, bodyName: body.name || body.id },
    locale: localeFrom(req),
    theme,
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.error, code: result.code ?? "UPSTREAM_ERROR" },
      { status: result.status },
    );
  }
  return Response.json({
    embedUrl: result.session.embedUrl,
    chatId: result.session.chatId,
    agentId: result.session.agentId,
    expiresAt: result.session.expiresAt,
    expiresIn: result.session.expiresIn,
  });
}
