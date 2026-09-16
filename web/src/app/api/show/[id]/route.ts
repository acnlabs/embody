import { loadOwnedShow } from "@/lib/ownerBody";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const loaded = await loadOwnedShow(req, id);
  if ("error" in loaded) {
    return Response.json({ ok: false, error: loaded.error }, { status: loaded.status });
  }
  return Response.json({
    ok: true,
    audience: "owner",
    workplace: "studio",
    show: loaded.show,
  });
}

export function POST() {
  return Response.json(
    { ok: false, error: "drive this body at POST /api/show/[id]/drive" },
    { status: 405 },
  );
}
