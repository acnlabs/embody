import { randomBytes } from "crypto";
import { parseDrive } from "@/lib/drive";
import { getBody, putDrive } from "@/lib/ledger";
import { fetchMyAgents } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sub = await verifyUserToken(req);
  if (!sub) {
    return Response.json({ ok: false, error: "owner Auth0 token required" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await getBody(id);
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
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON body required" }, { status: 400 });
  }
  const parsed = parseDrive(payload, `drv_${randomBytes(4).toString("hex")}`, new Date().toISOString());
  if ("error" in parsed) {
    return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  await putDrive(id, parsed);
  return Response.json({
    ok: true,
    queued: true,
    command: parsed,
    note: "Last write wins. push --watch on the machine runs this.",
  });
}
