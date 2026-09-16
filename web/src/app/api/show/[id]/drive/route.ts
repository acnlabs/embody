import { randomBytes } from "crypto";
import { parseControlEvent, type ControlEvent } from "@/lib/control";
import { parseDrive } from "@/lib/drive";
import { appendBodyControl, putDrive } from "@/lib/ledger";
import { assertOwnedBody } from "@/lib/ownerBody";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const owned = await assertOwnedBody(req, id);
  if ("error" in owned) {
    return Response.json({ ok: false, error: owned.error }, { status: owned.status });
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
  const control = event ? await appendBodyControl(id, event) : owned.body.control || [];
  return Response.json({
    ok: true,
    queued: true,
    command: parsed,
    control,
    note: "Last write wins.",
  });
}
