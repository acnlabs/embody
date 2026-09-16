import { bodyIsLive, OWNER_ERR } from "@/lib/copy";
import { isDriveListening } from "@/lib/drive";
import {
  hostCorsHeaders,
  hostPath,
  isHostParentOrigin,
} from "@/lib/hostFrame";
import { mintHostToken } from "@/lib/hostToken";
import { listBodiesForAgents } from "@/lib/ledger";
import { bareAgentId, fetchMyAgents } from "@/lib/myAgents";
import type { BodyShow } from "@/lib/types";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

function bodyIsOn(row: BodyShow): boolean {
  return bodyIsLive({
    session_running: row.session_running,
    drive_listening: isDriveListening(row.drive_listen_at),
  });
}

function pickList(bodies: BodyShow[]) {
  return bodies
    .slice()
    .sort(
      (a, b) =>
        Number(bodyIsOn(b)) - Number(bodyIsOn(a)) ||
        (b.pushed_at || "").localeCompare(a.pushed_at || "") ||
        b.id.localeCompare(a.id),
    )
    .map((row) => ({
      id: row.id,
      name: row.name || row.id,
      origin: row.origin,
      live: bodyIsOn(row),
    }));
}

function corsJson(body: unknown, status: number, origin: string): Response {
  return Response.json(body, {
    status,
    headers: origin ? hostCorsHeaders(origin) : undefined,
  });
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")?.trim() || "";
  const self = new URL(req.url).origin;
  if (origin && !isHostParentOrigin(origin, self)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: origin ? hostCorsHeaders(origin) : undefined });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin")?.trim() || "";
  const self = new URL(req.url).origin;
  if (origin && !isHostParentOrigin(origin, self)) {
    return new Response(null, { status: 403 });
  }

  const sub = await verifyUserToken(req);
  const gat = extractBearerToken(req);
  if (!sub || !gat) {
    return corsJson({ ok: false, error: OWNER_ERR.login, code: "unauthorized" }, 401, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson({ ok: false, error: "JSON body required", code: "bad_request" }, 400, origin);
  }

  if (String(payload.intent ?? "open") !== "open") {
    return corsJson({ ok: false, error: "intent open required", code: "bad_request" }, 400, origin);
  }

  const agentId = bareAgentId(String(payload.agentId ?? ""));
  const wantedId = String(payload.bodyId ?? "").trim();
  if (!agentId) {
    return corsJson({ ok: false, error: "agentId required", code: "bad_request" }, 400, origin);
  }

  const mine = await fetchMyAgents(gat);
  if (mine == null) {
    return corsJson({ ok: false, error: OWNER_ERR.down, code: "down" }, 502, origin);
  }
  if (!mine.some((row) => row.id === agentId)) {
    return corsJson({ ok: false, error: OWNER_ERR.forbidden, code: "forbidden" }, 403, origin);
  }

  const bodies = (await listBodiesForAgents(mine.map((row) => row.id))).filter(
    (row) => bareAgentId(row.bound_agent_id) === agentId,
  );
  if (!wantedId && bodies.length > 1) {
    return corsJson({ ok: true, pick: true, agentId, bodies: pickList(bodies) }, 200, origin);
  }
  const picked = wantedId
    ? bodies.find((row) => row.id === wantedId)
    : bodies[0];
  if (!picked) {
    return corsJson(
      { ok: false, error: "This agent has no body yet.", code: "no_body" },
      404,
      origin,
    );
  }

  const minted = await mintHostToken({
    sub,
    bodyId: picked.id,
    agentId: bareAgentId(picked.bound_agent_id),
    gat,
  });
  if (!minted) {
    return corsJson({ ok: false, error: OWNER_ERR.down, code: "failed" }, 503, origin);
  }

  return corsJson(
    {
      ok: true,
      id: picked.id,
      bodyId: picked.id,
      name: picked.name || picked.id,
      agentId: bareAgentId(picked.bound_agent_id),
      hostPath: hostPath(picked.id),
      hostToken: minted.hostToken,
      hostExpiresIn: minted.hostExpiresIn,
    },
    200,
    origin,
  );
}
