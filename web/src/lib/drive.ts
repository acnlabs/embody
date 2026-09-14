export const TWIST_X = 0.3;
export const TWIST_Y = 0.2;
export const TWIST_YAW = 1.5;
export const DRIVE_LISTEN_MS = 12_000;
export const DRIVE_CMD_TTL_MS = 30_000;

const ALIAS_RE = /^[a-z][a-z0-9_]{0,31}$/;

export type DriveCmd =
  | { id: string; at: string; op: "twist"; x: number; y: number; yaw: number }
  | { id: string; at: string; op: "do"; alias: string }
  | { id: string; at: string; op: "halt" };

function finite(raw: unknown, fallback = 0): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function isDriveListening(at?: string): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && Date.now() - t < DRIVE_LISTEN_MS;
}

export function isDriveFresh(cmd: DriveCmd): boolean {
  const t = Date.parse(cmd.at);
  return Number.isFinite(t) && Date.now() - t < DRIVE_CMD_TTL_MS;
}

export function parseDrive(
  raw: unknown,
  id: string,
  at: string,
): DriveCmd | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "need twist, do, or halt" };
  }
  const row = raw as Record<string, unknown>;
  if (row.halt === true) {
    return { id, at, op: "halt" };
  }
  if (row.do != null) {
    const alias = String(row.do).trim();
    if (!ALIAS_RE.test(alias)) {
      return { error: "do alias must be a lowercase skill slot" };
    }
    return { id, at, op: "do", alias };
  }
  if (row.twist && typeof row.twist === "object") {
    const t = row.twist as Record<string, unknown>;
    return {
      id,
      at,
      op: "twist",
      x: clamp(finite(t.x), -TWIST_X, TWIST_X),
      y: clamp(finite(t.y), -TWIST_Y, TWIST_Y),
      yaw: clamp(finite(t.yaw), -TWIST_YAW, TWIST_YAW),
    };
  }
  return { error: "need twist, do, or halt" };
}
