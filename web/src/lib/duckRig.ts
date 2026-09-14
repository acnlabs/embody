import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { hingeAngle, type DuckPose } from "@/lib/duckPose";

type KinJoint = {
  name: string;
  axis: number[];
  type?: string;
  range?: [number, number];
};

type KinGeom = {
  type?: string;
  mesh?: string;
  pos?: number[];
  quat?: number[];
  color?: number[];
};

type KinBody = {
  name: string;
  parent: string | null;
  pos: number[];
  quat: number[];
  geoms: KinGeom[];
  joint: KinJoint | null;
};

type Kinematics = { bodies: KinBody[] };

type Joint = {
  body: THREE.Object3D;
  axis: THREE.Vector3;
  baseQuat: THREE.Quaternion;
};

export type DuckRig = {
  placer: THREE.Group;
  trunk: THREE.Object3D;
  trunkBasePos: THREE.Vector3;
  trunkBaseQuat: THREE.Quaternion;
  joints: Map<string, Joint>;
  leftFeet: THREE.MeshStandardMaterial[];
  rightFeet: THREE.MeshStandardMaterial[];
  leftFootHex: number[];
  rightFootHex: number[];
};

const CONTACT = 0x2f9e44;
const FOOT_MESH = {
  left: new Set(["foot_left.stl", "sole_left.stl", "ankle_left.stl"]),
  right: new Set(["foot_right.stl", "sole_right.stl", "ankle_right.stl"]),
};

const scratch = new THREE.Quaternion();

export async function loadDuckRig(): Promise<DuckRig> {
  const [kin, gltf] = await Promise.all([
    fetch("/microduck/kinematics.json").then((res) => {
      if (!res.ok) throw new Error(`kinematics ${res.status}`);
      return res.json() as Promise<Kinematics>;
    }),
    new GLTFLoader().loadAsync("/microduck/microduck.glb"),
  ]);

  const geoms = new Map<string, THREE.BufferGeometry>();
  gltf.scene.traverse((node: THREE.Object3D) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const name = mesh.name || mesh.geometry.name;
    if (name && !geoms.has(name)) geoms.set(name, mesh.geometry);
    if (mesh.userData.meshFile && !geoms.has(mesh.userData.meshFile)) {
      geoms.set(String(mesh.userData.meshFile), mesh.geometry);
    }
  });

  const placer = new THREE.Group();
  placer.name = "duck_placer";
  const root = new THREE.Group();
  root.name = "duck_root";
  root.rotation.x = -Math.PI / 2;
  placer.add(root);

  const bodies = new Map<string, THREE.Group>();
  for (const body of kin.bodies) {
    const group = new THREE.Group();
    group.name = body.name;
    group.position.set(body.pos[0], body.pos[1], body.pos[2]);
    group.quaternion.set(body.quat[1], body.quat[2], body.quat[3], body.quat[0]);
    bodies.set(body.name, group);
  }
  for (const body of kin.bodies) {
    const group = bodies.get(body.name);
    if (!group) continue;
    const parent = body.parent ? bodies.get(body.parent) : undefined;
    (parent ?? root).add(group);
  }

  const joints = new Map<string, Joint>();
  for (const body of kin.bodies) {
    if (!body.joint || (body.joint.type && body.joint.type !== "hinge")) continue;
    const group = bodies.get(body.name);
    if (!group) continue;
    joints.set(body.joint.name, {
      body: group,
      axis: new THREE.Vector3(...body.joint.axis).normalize(),
      baseQuat: group.quaternion.clone(),
    });
  }

  const leftFeet: THREE.MeshStandardMaterial[] = [];
  const rightFeet: THREE.MeshStandardMaterial[] = [];
  const leftFootHex: number[] = [];
  const rightFootHex: number[] = [];
  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  const seen = new Set<string>();

  for (const body of kin.bodies) {
    const group = bodies.get(body.name);
    if (!group) continue;
    for (const geom of body.geoms) {
      if ((geom.type && geom.type !== "mesh") || !geom.mesh) continue;
      const geometry = geoms.get(geom.mesh);
      if (!geometry) continue;
      const key = `${body.name}|${geom.mesh}|${geom.pos}|${geom.quat}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const color = geom.color ?? [0.85, 0.85, 0.85, 1];
      const matKey = color.join(",");
      let material = matCache.get(matKey);
      if (!material) {
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color[0], color[1], color[2]),
          roughness: 0.48,
          metalness: 0.06,
          transparent: (color[3] ?? 1) < 1,
          opacity: color[3] ?? 1,
        });
        matCache.set(matKey, material);
      }
      if (FOOT_MESH.left.has(geom.mesh)) {
        material = material.clone();
        leftFeet.push(material);
        leftFootHex.push(material.color.getHex());
      } else if (FOOT_MESH.right.has(geom.mesh)) {
        material = material.clone();
        rightFeet.push(material);
        rightFootHex.push(material.color.getHex());
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.meshName = geom.mesh;
      if (geom.pos) mesh.position.set(geom.pos[0], geom.pos[1], geom.pos[2]);
      if (geom.quat) mesh.quaternion.set(geom.quat[1], geom.quat[2], geom.quat[3], geom.quat[0]);
      group.add(mesh);
    }
  }

  const trunk = bodies.get("trunk_base");
  if (!trunk) throw new Error("kinematics missing trunk_base");

  return {
    placer,
    trunk,
    trunkBasePos: trunk.position.clone(),
    trunkBaseQuat: trunk.quaternion.clone(),
    joints,
    leftFeet,
    rightFeet,
    leftFootHex,
    rightFootHex,
  };
}

export function applyDuckPose(rig: DuckRig, pose: DuckPose) {
  if (pose.quat) {
    rig.trunk.quaternion.set(pose.quat[1], pose.quat[2], pose.quat[3], pose.quat[0]);
  } else {
    rig.trunk.quaternion.copy(rig.trunkBaseQuat);
  }
  rig.trunk.position.set(0, 0, pose.trunkZ ?? rig.trunkBasePos.z);

  for (const [name, joint] of rig.joints) {
    scratch.setFromAxisAngle(joint.axis, hingeAngle(pose, name));
    joint.body.quaternion.copy(joint.baseQuat).multiply(scratch);
  }

  for (let i = 0; i < rig.leftFeet.length; i++) {
    rig.leftFeet[i].color.setHex(pose.feet.left ? CONTACT : rig.leftFootHex[i]);
  }
  for (let i = 0; i < rig.rightFeet.length; i++) {
    rig.rightFeet[i].color.setHex(pose.feet.right ? CONTACT : rig.rightFootHex[i]);
  }
}
