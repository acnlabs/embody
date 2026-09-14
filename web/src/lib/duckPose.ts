export type QuatWxyz = [number, number, number, number];

export type DuckPose = {
  joints: Record<string, number>;
  quat: QuatWxyz | null;
  trunkZ: number | null;
  feet: { left?: boolean; right?: boolean };
  hasJoints: boolean;
};

const HOME: DuckPose = {
  joints: {},
  quat: null,
  trunkZ: null,
  feet: {},
  hasJoints: false,
};

function asFinite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asQuat(value: unknown): QuatWxyz | null {
  if (!Array.isArray(value) || value.length < 4) return null;
  const w = asFinite(value[0]);
  const x = asFinite(value[1]);
  const y = asFinite(value[2]);
  const z = asFinite(value[3]);
  if (w == null || x == null || y == null || z == null) return null;
  return [w, x, y, z];
}

function asJoints(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = asFinite(raw);
    if (n != null) out[name] = n;
  }
  return out;
}

function asFoot(value: unknown): boolean | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const contact = (value as { contact?: unknown }).contact;
  return typeof contact === "boolean" ? contact : undefined;
}

/** Lift `status.body_state` (or a flat fixture) into a pose the viewer can apply. */
export function poseFromNumbers(
  numbers: Record<string, unknown> | null | undefined,
): DuckPose {
  if (!numbers) return HOME;
  const nested =
    numbers.body_state && typeof numbers.body_state === "object" && !Array.isArray(numbers.body_state)
      ? (numbers.body_state as Record<string, unknown>)
      : numbers;
  const joints = asJoints(nested.joints_rel_home);
  const feetRaw =
    nested.feet && typeof nested.feet === "object" && !Array.isArray(nested.feet)
      ? (nested.feet as Record<string, unknown>)
      : {};
  return {
    joints,
    quat: asQuat(nested.quat),
    trunkZ: asFinite(nested.trunk_z_m) ?? asFinite(nested.xyz && Array.isArray(nested.xyz) ? nested.xyz[2] : undefined) ?? null,
    feet: { left: asFoot(feetRaw.left), right: asFoot(feetRaw.right) },
    hasJoints: Object.keys(joints).length > 0,
  };
}
