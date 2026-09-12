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
    return Response.json({ ok: false, error: "owner Auth0 token required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = getBody(id);
  if (!body) {
    return Response.json({ ok: false, error: "body not pushed" }, { status: 404 });
  }
  const bearer = extractBearerToken(req);
  const mine = bearer ? await fetchMyAgents(bearer) : null;
  if (mine == null) {
    return Response.json({ ok: false, error: "could not read my-agents" }, { status: 502 });
  }
  if (!mine.some((row) => row.id === body.bound_agent_id)) {
    return Response.json({ ok: false, error: "这具身体不属于你的 agent" }, { status: 403 });
  }
  return Response.json({
    ok: true,
    audience: "owner",
    workplace: "studio",
    show: body,
  });
}

export function POST() {
  return Response.json({ ok: false, error: "owner studio does not drive the body" }, { status: 405 });
}
