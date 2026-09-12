import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { BodyShow } from "@/lib/types";

type Ledger = { bodies: Record<string, BodyShow> };

function ledgerPath(): string {
  return process.env.EMBODY_WEB_LEDGER?.trim() || join(process.cwd(), ".data", "ledger.json");
}

function empty(): Ledger {
  return { bodies: {} };
}

function read(): Ledger {
  try {
    const raw = readFileSync(ledgerPath(), "utf8");
    const parsed = JSON.parse(raw) as Ledger;
    if (!parsed || typeof parsed !== "object" || !parsed.bodies) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(ledger: Ledger): void {
  const file = ledgerPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(ledger, null, 2), "utf8");
}

export function upsertBody(show: BodyShow): BodyShow {
  const ledger = read();
  const stored: BodyShow = { ...show, pushed_at: new Date().toISOString() };
  ledger.bodies[show.id] = stored;
  write(ledger);
  return stored;
}

export function getBody(id: string): BodyShow | null {
  return read().bodies[id] ?? null;
}

export function listBodiesForAgents(agentIds: string[]): BodyShow[] {
  const allow = new Set(agentIds);
  return Object.values(read().bodies).filter((row) => allow.has(row.bound_agent_id));
}
