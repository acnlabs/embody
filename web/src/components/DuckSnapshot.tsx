"use client";

import { useEffect, useRef } from "react";
import type { DuckPose } from "@/lib/duckPose";

type Mat4 = number[];

const INK = "#1c3d5a";
const INK_SOFT = "#47617d";
const BILL = "#e8590c";
const LEG = "#5c738c";
const CONTACT = "#2f9e44";
const PAPER = "#f4f1ea";
const GRID = "rgba(28, 61, 90, 0.14)";
const NOMINAL_Z = 0.12;

function ident(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mul(a: Mat4, b: Mat4): Mat4 {
  const o = ident();
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

function T(x: number, y: number, z: number): Mat4 {
  const m = ident();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

function Rx(r: number): Mat4 {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function Ry(r: number): Mat4 {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

function Rz(r: number): Mat4 {
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function quatMat(w: number, x: number, y: number, z: number): Mat4 {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    1 - 2 * (yy + zz),
    2 * (xy + wz),
    2 * (xz - wy),
    0,
    2 * (xy - wz),
    1 - 2 * (xx + zz),
    2 * (yz + wx),
    0,
    2 * (xz + wy),
    2 * (yz - wx),
    1 - 2 * (xx + yy),
    0,
    0,
    0,
    0,
    1,
  ];
}

function xform(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

function chain(parent: Mat4, ...rest: Mat4[]): Mat4 {
  return rest.reduce((acc, m) => mul(acc, m), parent);
}

function joint(pose: DuckPose, name: string): number {
  return pose.joints[name] ?? 0;
}

type Face = { poly: [number, number][]; depth: number; color: string };

const CUBE: [number, number, number][] = [
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
];

const QUADS: [number, number, number, number][] = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 3, 7, 4],
  [1, 2, 6, 5],
];

function lookAt(eye: [number, number, number], target: [number, number, number]): Mat4 {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  const zlen = Math.hypot(zx, zy, zz) || 1;
  const z0 = zx / zlen;
  const z1 = zy / zlen;
  const z2 = zz / zlen;
  let x0 = -z1;
  let x1 = z0;
  let x2 = 0;
  let xlen = Math.hypot(x0, x1, x2);
  if (xlen < 1e-6) {
    x0 = 1;
    x1 = 0;
    x2 = 0;
    xlen = 1;
  } else {
    x0 /= xlen;
    x1 /= xlen;
    x2 /= xlen;
  }
  const y0 = z1 * x2 - z2 * x1;
  const y1 = z2 * x0 - z0 * x2;
  const y2 = z0 * x1 - z1 * x0;
  return [
    x0,
    y0,
    z0,
    0,
    x1,
    y1,
    z1,
    0,
    x2,
    y2,
    z2,
    0,
    -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]),
    -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ];
}

function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2);
  const m = ident();
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  m[15] = 0;
  return m;
}

function project(
  mvp: Mat4,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
): [number, number, number] | null {
  const cx = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const cy = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const cz = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
  const cw = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];
  if (cw === 0) return null;
  const ndcX = cx / cw;
  const ndcY = cy / cw;
  const ndcZ = cz / cw;
  return [((ndcX + 1) / 2) * w, ((1 - ndcY) / 2) * h, ndcZ];
}

function pushBox(
  faces: Face[],
  mvp: Mat4,
  world: Mat4,
  size: [number, number, number],
  origin: [number, number, number],
  color: string,
  width: number,
  height: number,
) {
  const corners = CUBE.map(([x, y, z]) => {
    const px = origin[0] + x * size[0];
    const py = origin[1] + y * size[1];
    const pz = origin[2] + z * size[2];
    return xform(world, px, py, pz);
  });
  for (const q of QUADS) {
    const pts: [number, number][] = [];
    let depth = 0;
    let ok = true;
    for (const i of q) {
      const p = project(mvp, corners[i][0], corners[i][1], corners[i][2], width, height);
      if (!p) {
        ok = false;
        break;
      }
      pts.push([p[0], p[1]]);
      depth += p[2];
    }
    if (!ok) continue;
    const a = corners[q[1]];
    const b = corners[q[0]];
    const c = corners[q[2]];
    const n0 = a[0] - b[0];
    const n1 = a[1] - b[1];
    const n2 = a[2] - b[2];
    const m0 = c[0] - b[0];
    const m1 = c[1] - b[1];
    const m2 = c[2] - b[2];
    const nx = n1 * m2 - n2 * m1;
    const ny = n2 * m0 - n0 * m2;
    const nz = n0 * m1 - n1 * m0;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    const light = Math.max(0.35, (nx / nlen) * 0.25 + (ny / nlen) * 0.15 + (nz / nlen) * 0.85);
    faces.push({ poly: pts, depth: depth / 4, color: shade(color, light) });
  }
}

function shade(hex: string, light: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * light);
  const g = Math.round(((n >> 8) & 255) * light);
  const b = Math.round((n & 255) * light);
  return `rgb(${r},${g},${b})`;
}

function collectDuck(faces: Face[], mvp: Mat4, pose: DuckPose, width: number, height: number) {
  const q = pose.quat;
  const root = chain(
    T(0, 0, pose.trunkZ ?? NOMINAL_Z),
    q ? quatMat(q[0], q[1], q[2], q[3]) : ident(),
  );
  pushBox(faces, mvp, root, [0.09, 0.07, 0.05], [-0.004, 0, 0.002], INK, width, height);
  pushBox(faces, mvp, root, [0.04, 0.062, 0.036], [-0.038, 0, 0.002], INK_SOFT, width, height);

  const addLeg = (side: 1 | -1) => {
    const prefix = side === 1 ? "left" : "right";
    const hipYaw = chain(root, T(0.004, side * 0.018, -0.008), Rz(joint(pose, `${prefix}_hip_yaw`)));
    const hipRoll = chain(hipYaw, Rx(joint(pose, `${prefix}_hip_roll`)));
    const hipPitch = chain(hipRoll, Ry(joint(pose, `${prefix}_hip_pitch`)));
    pushBox(faces, mvp, hipPitch, [0.028, 0.022, 0.05], [0.004, 0, -0.028], INK_SOFT, width, height);
    const knee = chain(hipPitch, T(0.004, 0, -0.052), Ry(joint(pose, `${prefix}_knee`)));
    pushBox(faces, mvp, knee, [0.022, 0.018, 0.046], [0, 0, -0.024], INK_SOFT, width, height);
    const ankle = chain(knee, T(0, 0, -0.048), Ry(joint(pose, `${prefix}_ankle`)));
    const footColor = pose.feet[prefix] ? CONTACT : LEG;
    pushBox(faces, mvp, ankle, [0.05, 0.028, 0.01], [0.008, 0, -0.006], footColor, width, height);
  };
  addLeg(1);
  addLeg(-1);

  const neck = chain(root, T(0.028, 0, 0.028), Ry(joint(pose, "neck_pitch")));
  const headPitch = chain(neck, T(0.012, 0, 0.012), Ry(joint(pose, "head_pitch")));
  const headYaw = chain(headPitch, Rz(joint(pose, "head_yaw")));
  const head = chain(headYaw, Rx(joint(pose, "head_roll")));
  pushBox(faces, mvp, head, [0.055, 0.052, 0.048], [0.018, 0, 0.004], INK, width, height);
  pushBox(faces, mvp, head, [0.042, 0.028, 0.014], [0.048, 0, -0.006], BILL, width, height);
}

function line(
  ctx: CanvasRenderingContext2D,
  mvp: Mat4,
  a: [number, number, number],
  b: [number, number, number],
  width: number,
  height: number,
) {
  const p1 = project(mvp, a[0], a[1], a[2], width, height);
  const p2 = project(mvp, b[0], b[1], b[2], width, height);
  if (!p1 || !p2) return;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
}

function drawGrid(ctx: CanvasRenderingContext2D, mvp: Mat4, width: number, height: number) {
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.05;
    line(ctx, mvp, [a, -0.2, 0], [a, 0.2, 0], width, height);
    line(ctx, mvp, [-0.2, a, 0], [0.2, a, 0], width, height);
  }
}

function render(
  ctx: CanvasRenderingContext2D,
  pose: DuckPose,
  orbit: { yaw: number; pitch: number; radius: number },
  width: number,
  height: number,
) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  const cp = Math.cos(orbit.pitch);
  const sp = Math.sin(orbit.pitch);
  const cy = Math.cos(orbit.yaw);
  const sy = Math.sin(orbit.yaw);
  const eye: [number, number, number] = [
    orbit.radius * cp * cy,
    orbit.radius * cp * sy,
    orbit.radius * sp + 0.06,
  ];
  const view = lookAt(eye, [0, 0, 0.07]);
  const proj = perspective(0.62, width / Math.max(height, 1), 0.05, 4);
  const mvp = mul(proj, view);
  drawGrid(ctx, mvp, width, height);
  const faces: Face[] = [];
  collectDuck(faces, mvp, pose, width, height);
  faces.sort((a, b) => b.depth - a.depth);
  for (const face of faces) {
    ctx.beginPath();
    ctx.moveTo(face.poly[0][0], face.poly[0][1]);
    for (let i = 1; i < face.poly.length; i++) ctx.lineTo(face.poly[i][0], face.poly[i][1]);
    ctx.closePath();
    ctx.fillStyle = face.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(28, 61, 90, 0.22)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }
}

export default function DuckSnapshot({ pose }: { pose: DuckPose }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const orbit = { yaw: 0.95, pitch: 0.38, radius: 0.42 };
    let raf = 0;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const fit = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth || 640;
      const h = parent?.clientHeight || 360;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    const tick = () => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const dpr = canvas.width / Math.max(canvas.clientWidth, 1);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render(ctx, poseRef.current, orbit, canvas.clientWidth, canvas.clientHeight);
      }
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      orbit.yaw -= (e.clientX - lastX) * 0.008;
      orbit.pitch = Math.min(1.2, Math.max(0.08, orbit.pitch + (e.clientY - lastY) * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.radius = Math.min(0.9, Math.max(0.22, orbit.radius + e.deltaY * 0.00045));
    };

    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="duck-stage">
      <canvas ref={canvasRef} role="img" aria-label="身体姿势快照，拖动可转视角" />
    </div>
  );
}
