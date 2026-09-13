export const MAX_BUILD_BYTES = 16 * 1024;

export type BuildParse =
  | { ok: true; build: Record<string, unknown> }
  | { ok: false; error: string };

export function asBuild(raw: unknown): BuildParse {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "build must be a JSON object" };
  }
  const build = raw as Record<string, unknown>;
  const bytes = Buffer.byteLength(JSON.stringify(build), "utf8");
  if (bytes > MAX_BUILD_BYTES) {
    return { ok: false, error: `build exceeds ${MAX_BUILD_BYTES} bytes` };
  }
  return { ok: true, build };
}
