import { fetchAgentId } from "@/lib/acn";
import { getBody, putPose, touchDriveListen } from "@/lib/ledger";
import { extractBearerToken } from "@/lib/userAuth";

export const runtime = "nodejs";

const MAX_POSE_BYTES = 32 * 1024;

export async function POST(req: Request) {
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return Response.json({ ok: false, error: "ACN bearer required" }, { status: 401 });
  }
  const agentId = await fetchAgentId(bearer);
  if (!agentId) {
    return Response.json({ ok: false, error: "ACN /agents/me rejected this key" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON body required" }, { status: 400 });
  }
  const row = payload as { id?: unknown; numbers?: unknown; numbers_error?: unknown; listen?: unknown };
  const id = String(row.id ?? "").trim();
  if (!id) {
    return Response.json({ ok: false, error: "pose needs body id" }, { status: 400 });
  }
  const body = await getBody(id);
  if (!body) {
    return Response.json({ ok: false, error: "unknown body id — join first" }, { status: 404 });
  }
  if (body.bound_agent_id !== agentId) {
    return Response.json({ ok: false, error: "bound_agent_id does not match this ACN key" }, { status: 403 });
  }
  const numbers =
    row.numbers && typeof row.numbers === "object" && !Array.isArray(row.numbers)
      ? (row.numbers as Record<string, unknown>)
      : null;
  const raw = JSON.stringify(numbers ?? {});
  if (raw.length > MAX_POSE_BYTES) {
    return Response.json({ ok: false, error: "pose exceeds 32KiB" }, { status: 400 });
  }
  const pose = {
    numbers,
    numbers_error:
      typeof row.numbers_error === "string" ? row.numbers_error.slice(0, 240) : undefined,
    at: new Date().toISOString(),
  };
  await putPose(id, pose);
  if (row.listen) await touchDriveListen(id);
  return Response.json({ ok: true });
}
