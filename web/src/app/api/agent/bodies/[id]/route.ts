import { fetchAgentId } from "@/lib/acn";
import { deleteBody, getBody } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function DELETE(
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
    return Response.json({ ok: false, error: "unknown body id" }, { status: 404 });
  }
  if (body.bound_agent_id !== agentId) {
    return Response.json({ ok: false, error: "bound_agent_id does not match this ACN key" }, { status: 403 });
  }
  const removed = await deleteBody(id);
  return Response.json({
    ok: true,
    removed: removed?.id ?? id,
    note: "Body dropped from the hosted registry. Local ledger is the agent's to clear.",
  });
}
