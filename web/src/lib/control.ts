export const CONTROL_MAX = 24;
export const CONTROL_COALESCE_MS = 2500;

export type ControlOp = "start" | "stop" | "pull" | "twist" | "halt" | "do";
export type ControlSource = "agent" | "owner";

export type ControlEvent = {
  at: string;
  source: ControlSource;
  op: ControlOp;
  alias?: string;
  x?: number;
  y?: number;
  yaw?: number;
  executed?: boolean;
};

const OPS = new Set<ControlOp>(["start", "stop", "pull", "twist", "halt", "do"]);
const COALESCE = new Set<ControlOp>(["twist", "halt"]);

function finite(raw: unknown): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function parseControlEvent(raw: unknown): ControlEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const source = row.source === "owner" || row.source === "agent" ? row.source : null;
  const op = typeof row.op === "string" && OPS.has(row.op as ControlOp) ? (row.op as ControlOp) : null;
  const at = typeof row.at === "string" ? row.at.trim() : "";
  if (!source || !op || !at) return null;
  const event: ControlEvent = { at: at.slice(0, 40), source, op };
  if (typeof row.alias === "string" && row.alias.trim()) {
    event.alias = row.alias.trim().slice(0, 32);
  }
  if (op === "twist") {
    const x = finite(row.x);
    const y = finite(row.y);
    const yaw = finite(row.yaw);
    if (x != null) event.x = x;
    if (y != null) event.y = y;
    if (yaw != null) event.yaw = yaw;
  }
  if (typeof row.executed === "boolean") event.executed = row.executed;
  return event;
}

function sameShape(a: ControlEvent, b: ControlEvent): boolean {
  return a.source === b.source && a.op === b.op && (a.alias || "") === (b.alias || "");
}

function within(a: string, b: string, ms: number): boolean {
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(right - left) <= ms;
}

export function appendControl(
  log: ControlEvent[] | undefined,
  event: ControlEvent | null | undefined,
): ControlEvent[] {
  if (!event) return log ? log.slice(-CONTROL_MAX) : [];
  const next = log ? log.slice() : [];
  const last = next[next.length - 1];
  if (last && COALESCE.has(event.op) && sameShape(last, event) && within(last.at, event.at, CONTROL_COALESCE_MS)) {
    next[next.length - 1] = event;
    return next.slice(-CONTROL_MAX);
  }
  next.push(event);
  return next.slice(-CONTROL_MAX);
}
