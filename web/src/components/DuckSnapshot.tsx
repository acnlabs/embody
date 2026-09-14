"use client";

import { useEffect, useRef } from "react";
import type { DuckPose } from "@/lib/duckPose";

const PAPER = 0xf4f1ea;

export default function DuckSnapshot({ pose }: { pose: DuckPose }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const poseRef = useRef(pose);
  poseRef.current = pose;

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
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      const { applyDuckPose, loadDuckRig } = await import("@/lib/duckRig");
      if (dead || !hostRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(PAPER);
      const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.02, 8);
      camera.position.set(0.28, 0.16, 0.3);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.setAttribute("aria-label", "身体姿势，拖动转视角");
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
      camera.position.set(center.x + size * 1.15, center.y + size * 0.55, center.z + size * 1.3);
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

      const fit = () => {
        if (!renderer) return;
        const w = host.clientWidth || 640;
        const h = host.clientHeight || 360;
        renderer.setSize(w, h, false);
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
      };
      fit();
      resize = new ResizeObserver(fit);
      resize.observe(host);

      const tick = () => {
        if (dead || !renderer) return;
        applyDuckPose(rig, poseRef.current);
        orbit.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      resize?.disconnect();
      controls?.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }, []);

  return <div className="duck-stage" ref={hostRef} />;
}
