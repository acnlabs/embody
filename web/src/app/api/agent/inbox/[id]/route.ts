import { fetchAgentId } from "@/lib/acn";
import { getBody, takeDrive, touchDriveListen } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return Response.json({ ok: false, error: "ACN bearer required" }, { status: 401 });
  }
  const agentId = await fetchAgentId(bearer);
  if (!agentId) {
    return Response.json({ ok: false, error: "ACN /agents/me rejected this key" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await getBody(id);
  if (!body) {
    return Response.json({ ok: false, error: "unknown body id — join first" }, { status: 404 });
  }
  if (body.bound_agent_id !== agentId) {
    return Response.json({ ok: false, error: "bound_agent_id does not match this ACN key" }, { status: 403 });
  }
  await touchDriveListen(id);
  const command = await takeDrive(id);
  return Response.json({ ok: true, command });
}
