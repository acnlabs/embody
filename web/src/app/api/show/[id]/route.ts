import { OWNER_ERR } from "@/lib/copy";
import { isDriveListening } from "@/lib/drive";
import { getBody } from "@/lib/ledger";
import { fetchMyAgents } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    return Response.json({ ok: false, error: OWNER_ERR.login }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await getBody(id);
  if (!body) {
    return Response.json({ ok: false, error: OWNER_ERR.missing }, { status: 404 });
  }
  const bearer = extractBearerToken(req);
  const mine = bearer ? await fetchMyAgents(bearer) : null;
  if (mine == null) {
    return Response.json({ ok: false, error: OWNER_ERR.down }, { status: 502 });
  }
  if (!mine.some((row) => row.id === body.bound_agent_id)) {
    return Response.json({ ok: false, error: OWNER_ERR.forbidden }, { status: 403 });
  }
  return Response.json({
    ok: true,
    audience: "owner",
    workplace: "studio",
    show: {
      ...body,
      drive_listening: isDriveListening(body.drive_listen_at),
    },
  });
}

export function POST() {
  return Response.json(
    { ok: false, error: "drive this body at POST /api/show/[id]/drive" },
    { status: 405 },
  );
}
