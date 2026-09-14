"use client";

import { useEffect, useRef } from "react";
import type { DuckPose } from "@/lib/duckPose";

const PAPER = 0xf4f1ea;

export default function DuckSnapshot({
  pose,
  ariaLabel,
  still = false,
}: {
  pose: DuckPose;
  ariaLabel: string;
  still?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef(pose);
  const labelRef = useRef(ariaLabel);
  const drawRef = useRef<(() => void) | null>(null);
  poseRef.current = pose;
  labelRef.current = ariaLabel;

  useEffect(() => {
    const canvas = hostRef.current?.querySelector("canvas");
    if (canvas) canvas.setAttribute("aria-label", ariaLabel);
  }, [ariaLabel]);

  useEffect(() => {
    drawRef.current?.();
  }, [pose]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dead = false;
    let raf = 0;
    let renderer: import("three").WebGLRenderer | null = null;
    let controls: { update: () => void; dispose: () => void } | null = null;
    let resize: ResizeObserver | null = null;

    void (async () => {
      const THREE = await import("three");
      const { applyDuckPose, loadDuckRig } = await import("@/lib/duckRig");
      if (dead || !hostRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(PAPER);
      const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.02, 8);
      camera.position.set(0.28, 0.16, 0.3);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, still ? 1.5 : 2));
      renderer.shadowMap.enabled = true;
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", labelRef.current);
      if (still) renderer.domElement.style.pointerEvents = "none";
      host.appendChild(renderer.domElement);

      scene.add(new THREE.HemisphereLight(0xfbf9f4, 0xb9c4cf, 1.1));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(0.35, 0.55, 0.25);
      key.castShadow = true;
      scene.add(key);

      const floor = new THREE.Mesh(
        new THREE.CircleGeometry(0.28, 48),
        new THREE.MeshStandardMaterial({ color: 0xe8e4db, roughness: 1, metalness: 0 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const grid = new THREE.GridHelper(0.4, 8, 0xc5cdd6, 0xd9dee4);
      grid.position.y = 0.001;
      scene.add(grid);

      const rig = await loadDuckRig();
      if (dead) return;
      scene.add(rig.placer);
      applyDuckPose(rig, poseRef.current);
      rig.placer.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(rig.placer);
      if (Number.isFinite(box.min.y)) {
        rig.placer.position.y += 0.002 - box.min.y;
        rig.placer.updateWorldMatrix(true, true);
        box.setFromObject(rig.placer);
      }
      const center = box.getCenter(new THREE.Vector3());
      const size = Math.max(box.getSize(new THREE.Vector3()).length(), 0.12);
      const near = still ? 0.95 : 1.15;
      camera.position.set(center.x + size * near, center.y + size * 0.5, center.z + size * (still ? 1.15 : 1.3));
      camera.lookAt(center);

      if (!still) {
        const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
        if (dead || !renderer) return;
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enablePan = false;
        orbit.enableDamping = true;
        orbit.dampingFactor = 0.08;
        orbit.minDistance = Math.max(0.08, size * 0.35);
        orbit.maxDistance = Math.max(0.9, size * 4);
        orbit.target.copy(center);
        const keyed = orbit as { enableKeys?: boolean };
        if ("enableKeys" in keyed) keyed.enableKeys = false;
        orbit.update();
        controls = orbit;
      }

      const fit = () => {
        if (!renderer) return;
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
        if (still) renderer.render(scene, camera);
      };
      fit();
      resize = new ResizeObserver(fit);
      resize.observe(host);

      const draw = () => {
        if (dead || !renderer) return;
        applyDuckPose(rig, poseRef.current);
        controls?.update();
        renderer.render(scene, camera);
      };
      drawRef.current = draw;

      if (still) {
        draw();
        return;
      }

      const tick = () => {
        if (dead || !renderer) return;
        draw();
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      dead = true;
      drawRef.current = null;
      cancelAnimationFrame(raf);
      resize?.disconnect();
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, [still]);

  return <div className={`duck-stage${still ? " still" : ""}`} ref={hostRef} />;
}
