/** Owner-facing words. Agent / CLI language stays off this surface. */

export function originLabel(origin: string): string {
  if (origin === "robot") return "真机";
  if (origin === "sim") return "仿真";
  return origin;
}

export function sessionLabel(running?: boolean): string {
  return running ? "开着" : "还没开";
}

export function cardModeLabel(mode?: string): string | null {
  if (mode === "perpetual") return "步态";
  if (mode === "episodic") return "招式";
  return mode || null;
}

export function buildKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    bom: "型号",
    serial: "编号",
    modules: "模块",
    calibration: "标定",
  };
  return labels[key] || key;
}

export const OWNER_ERR = {
  login: "请先登录",
  missing: "找不到这具身体",
  forbidden: "这不是你的身体",
  down: "暂时打不开",
} as const;

export function ownerError(raw: string): string {
  if (/token required|Auth0 token|unauthorized/i.test(raw)) return "请先登录。";
  if (/my-agents/i.test(raw)) return "暂时打不开。";
  if (/not pushed|unknown body/i.test(raw)) return "找不到这具身体。";
  if (/不属于|does not match/i.test(raw)) return "这不是你的身体。";
  if (/load failed|Failed to fetch|NetworkError/i.test(raw)) return "加载失败。";
  if (/drive failed/i.test(raw)) return "现在开不了。";
  if (/need twist|do alias|JSON body/i.test(raw)) return "现在开不了。";
  return raw;
}
