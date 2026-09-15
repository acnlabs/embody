import { randomBytes } from "crypto";
import { parseControlEvent, type ControlEvent } from "@/lib/control";
import { OWNER_ERR } from "@/lib/copy";
import { parseDrive } from "@/lib/drive";
import { appendBodyControl, getBody, putDrive } from "@/lib/ledger";
import { fetchMyAgents } from "@/lib/myAgents";
import { extractBearerToken, verifyUserToken } from "@/lib/userAuth";

export const runtime = "nodejs";

export async function POST(
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
  const event: ControlEvent | null = parseControlEvent({
    at: parsed.at,
    source: "owner",
    op: parsed.op,
    ...(parsed.op === "do" ? { alias: parsed.alias } : {}),
    ...(parsed.op === "twist" ? { x: parsed.x, y: parsed.y, yaw: parsed.yaw } : {}),
  });
  const control = event ? await appendBodyControl(id, event) : (body.control || []);
  return Response.json({
    ok: true,
    queued: true,
    command: parsed,
    control,
    note: "Last write wins.",
  });
}
