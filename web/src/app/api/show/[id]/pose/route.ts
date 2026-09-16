import { getPose } from "@/lib/ledger";
import { assertOwnedBody } from "@/lib/ownerBody";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const owned = await assertOwnedBody(req, id);
  if ("error" in owned) {
    return Response.json({ ok: false, error: owned.error }, { status: owned.status });
  }
  const pose = await getPose(id);
  return Response.json({
    ok: true,
    numbers: pose?.numbers ?? null,
    numbers_error: pose?.numbers_error,
    at: pose?.at,
  });
}
