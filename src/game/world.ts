/**
 * Builds an expanded 3D Cotonou metropolis with multiple distinct districts & scenes:
 * Esplanade de l'Amazone, Boulevard de la Marina, Quartier Ganhi, Marché Dantokpa,
 * Plage de Fidjrossè, Port Autonome de Cotonou, and Haie Vive residential zone.
 */
import * as THREE from 'three';
import {
  createAmazoneMonument,
  createCotonouBuilding,
  createEsplanadeFloodlightPole,
  createMarinaHotel,
  createMarketStall,
  createPalaisDesCongres,
  createPalmTree,
} from './models';
import type { CotonouTextures } from './textures';

export interface BoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CotonouWorld {
  group: THREE.Group;
  colliders: BoxCollider[];
  oceanMaterial: THREE.MeshStandardMaterial;
  oceanMesh: THREE.Mesh;
  roadLoops: THREE.Vector3[][];
  getDistrictAt: (x: number, z: number) => string;
}

export function buildCotonouWorld(textures: CotonouTextures): CotonouWorld {
  const group = new THREE.Group();
  const colliders: BoxCollider[] = [];

  const registerBox = (cx: number, cz: number, w: number, d: number, pad = 0.3) => {
    colliders.push({
      minX: cx - w / 2 - pad,
      maxX: cx + w / 2 + pad,
      minZ: cz - d / 2 - pad,
      maxZ: cz + d / 2 + pad,
    });
  };

  // 1. Base City Ground Plane (Expanded for full city radius)
  const baseGroundMat = new THREE.MeshStandardMaterial({
    color: 0x453e35,
    roughness: 0.95,
    metalness: 0.02,
  });
  const baseGround = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), baseGroundMat);
  baseGround.rotation.x = -Math.PI / 2;
  baseGround.position.set(0, -0.02, -20);
  baseGround.receiveShadow = true;
  group.add(baseGround);

  // 2. Golden Coastal Beach Sand (South strip)
  const beachMat = new THREE.MeshStandardMaterial({
    map: textures.sand,
    roughness: 0.92,
    metalness: 0.02,
  });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(860, 56), beachMat);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.01, 58);
  beach.receiveShadow = true;
  group.add(beach);

  // 3. Atlantic Ocean (South horizon)
  const oceanMaterial = new THREE.MeshStandardMaterial({
    map: textures.ocean,
    color: 0x19799e,
    roughness: 0.22,
    metalness: 0.35,
  });
  const oceanMesh = new THREE.Mesh(new THREE.PlaneGeometry(960, 380), oceanMaterial);
  oceanMesh.rotation.x = -Math.PI / 2;
  oceanMesh.position.set(0, 0.0, 248);
  group.add(oceanMesh);

  // 4. Expanded Asphalt Road Network spanning the city
  const addRoad = (x: number, z: number, len: number, width: number, horizontal: boolean) => {
    const tex = textures.asphalt.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(1, Math.round(len / 18)));
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.05 });
    const geo = new THREE.PlaneGeometry(width, len);
    geo.rotateX(-Math.PI / 2);
    if (horizontal) geo.rotateY(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.03, z);
    mesh.receiveShadow = true;
    group.add(mesh);
  };

  // Major Avenues & Highways
  addRoad(0, 27, 340, 14, true); // Boulevard de la Marina
  addRoad(0, -28, 320, 12, true); // Avenue du Centenaire
  addRoad(0, -78, 320, 12, true); // Avenue Steinmetz (Ganhi)
  addRoad(0, -128, 320, 12, true); // Avenue de la Pointe

  addRoad(-116, -30, 220, 12, false); // Port Access Road
  addRoad(-68, -30, 220, 12, false);
  addRoad(-22, -30, 220, 12, false);
  addRoad(28, -30, 220, 12, false);
  addRoad(78, -30, 220, 12, false);
  addRoad(124, -30, 220, 12, false); // Haie Vive Avenue

  // 5. Vast Pale Travertine Esplanade de l'Amazone (Center Scene)
  const esplanadeMat = new THREE.MeshStandardMaterial({
    map: textures.esplanadeTile,
    roughness: 0.78,
    metalness: 0.04,
  });
  const esplanade = new THREE.Mesh(new THREE.BoxGeometry(60, 0.14, 42), esplanadeMat);
  esplanade.position.set(0, 0.02, -2);
  esplanade.receiveShadow = true;
  group.add(esplanade);

  const inlayMat = new THREE.MeshStandardMaterial({ color: 0xe6ded2, roughness: 0.72 });
  for (const rotY of [Math.PI / 4, -Math.PI / 4]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(48, 0.03, 0.75), inlayMat);
    line.position.set(0, 0.095, -2);
    line.rotation.y = rotY;
    line.receiveShadow = true;
    group.add(line);
  }

  const lawnMat = new THREE.MeshStandardMaterial({ color: 0x3b7a38, roughness: 0.9 });
  for (const side of [-1, 1]) {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.16, 34), lawnMat);
    lawn.position.set(side * 24, 0.03, -2);
    lawn.receiveShadow = true;
    group.add(lawn);
  }

  // Monument Amazone sculpture loaded from GLB
  const amazone = createAmazoneMonument(textures);
  amazone.position.set(0, 0.09, -2);
  group.add(amazone);
  registerBox(0, -2, 10.4, 11.2, 0.25);
  registerBox(-10.6, -1.6, 3.8, 5.2, 0.15);
  registerBox(10.6, -1.6, 3.8, 5.2, 0.15);

  const floodPositions: [number, number, number][] = [
    [-22, 14, -Math.PI * 0.75],
    [22, 14, Math.PI * 0.75],
    [-22, -16, -Math.PI * 0.25],
    [22, -16, Math.PI * 0.25],
    [-16, 2, -Math.PI / 2],
    [16, 2, Math.PI / 2],
  ];
  for (const [fx, fz, frot] of floodPositions) {
    const pole = createEsplanadeFloodlightPole();
    pole.position.set(fx, 0.09, fz);
    pole.rotation.y = frot;
    group.add(pole);
  }

  // Benin National Flagpoles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd0d5dd, metalness: 0.85, roughness: 0.25 });
  for (const sx of [-9, 9]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 8.5, 8), poleMat);
    pole.position.set(sx, 4.25, 16);
    pole.castShadow = true;
    group.add(pole);

    const green = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.06), new THREE.MeshStandardMaterial({ color: 0x008751 }));
    green.position.set(sx + 0.45, 7.8, 16);
    const yellow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.06), new THREE.MeshStandardMaterial({ color: 0xfcd116 }));
    yellow.position.set(sx + 1.4, 8.12, 16);
    const red = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.06), new THREE.MeshStandardMaterial({ color: 0xe8112d }));
    red.position.set(sx + 1.4, 7.48, 16);
    group.add(green, yellow, red);
  }

  // 6. Iconic Landmarks
  const marinaHotel = createMarinaHotel(textures);
  marinaHotel.position.set(60, 0.06, -4);
  marinaHotel.rotation.y = -0.35;
  group.add(marinaHotel);
  registerBox(60, -4, 34, 20, 0.5);

  const palais = createPalaisDesCongres();
  palais.position.set(-4, 0.06, -54);
  group.add(palais);
  registerBox(-4, -54, 42, 24, 0.5);

  // 7. Expanded Metropolis Building Blocks & Commercial Districts
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x7b756c, roughness: 0.86 });

  interface BuildingSpec {
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    style: 'warm' | 'terracotta' | 'modern';
    rot?: number;
  }

  const buildings: BuildingSpec[] = [
    { x: -56, z: 6, w: 16, h: 14, d: 14, style: 'modern', rot: 0 },
    { x: -56, z: -12, w: 15, h: 10, d: 12, style: 'warm', rot: Math.PI },
    { x: -56, z: -48, w: 16, h: 12, d: 14, style: 'terracotta', rot: 0 },
    { x: -56, z: -64, w: 14, h: 15, d: 10, style: 'warm', rot: Math.PI / 2 },
    { x: 56, z: -48, w: 14, h: 9, d: 12, style: 'warm', rot: 0 },
    { x: 56, z: -64, w: 15, h: 14, d: 10, style: 'terracotta', rot: -Math.PI / 2 },
    { x: -94, z: 4, w: 14, h: 13, d: 16, style: 'warm', rot: Math.PI / 2 },
    { x: -94, z: -52, w: 14, h: 16, d: 18, style: 'modern', rot: Math.PI / 2 },
    { x: 94, z: 4, w: 14, h: 12, d: 16, style: 'terracotta', rot: -Math.PI / 2 },
    { x: 94, z: -52, w: 14, h: 15, d: 18, style: 'modern', rot: -Math.PI / 2 },
    { x: -56, z: -96, w: 20, h: 17, d: 14, style: 'modern', rot: 0 },
    { x: -16, z: -96, w: 22, h: 20, d: 14, style: 'warm', rot: 0 },
    { x: 18, z: -96, w: 20, h: 15, d: 14, style: 'terracotta', rot: 0 },
    { x: 56, z: -96, w: 20, h: 18, d: 14, style: 'modern', rot: 0 },
    // Expanded Port & Haie Vive Sector buildings
    { x: -128, z: -16, w: 22, h: 24, d: 26, style: 'modern', rot: 0 },
    { x: -128, z: -56, w: 20, h: 18, d: 22, style: 'terracotta', rot: 0 },
    { x: 128, z: -16, w: 18, h: 16, d: 18, style: 'warm', rot: Math.PI / 2 },
    { x: 128, z: -56, w: 20, h: 22, d: 20, style: 'modern', rot: 0 },
    { x: 128, z: -96, w: 22, h: 25, d: 22, style: 'warm', rot: 0 },
    { x: -128, z: -96, w: 24, h: 20, d: 22, style: 'terracotta', rot: 0 },
  ];

  for (const b of buildings) {
    const mesh = createCotonouBuilding(b.w, b.h, b.d, b.style, textures);
    mesh.position.set(b.x, 0.06, b.z);
    if (b.rot) mesh.rotation.y = b.rot;
    group.add(mesh);
    registerBox(b.x, b.z, b.w, b.d, 0.35);
  }

  // Colorful Dantokpa Market Stalls
  const stallConfigs: [number, number, number, number][] = [
    [47, -38, 0xd97706, 0],
    [53, -38, 0x059669, 0],
    [59, -38, 0xdc2626, 0],
    [-26, 42, 0x2563eb, Math.PI],
    [-19, 42, 0xeab308, Math.PI],
    [22, 42, 0xd97706, Math.PI],
    [98, -48, 0x059669, 0],
    [104, -48, 0xd97706, Math.PI],
  ];
  for (const [sx, sz, col, rot] of stallConfigs) {
    const stall = createMarketStall(col);
    stall.position.set(sx, 0.04, sz);
    stall.rotation.y = rot;
    group.add(stall);
    registerBox(sx, sz, 3.4, 2.0, 0.2);
  }

  // 8. Coastal Coconut Palm Trees across Fidjrossè beach
  const palmPositions: [number, number, number][] = [
    [-28, 18, 1.05],
    [28, 18, 1.0],
    [-28, -18, 1.0],
    [28, -18, 1.05],
    [-64, 37, 1.15],
    [-46, 38, 0.95],
    [-28, 37, 1.1],
    [-8, 38, 1.05],
    [12, 37, 1.15],
    [32, 38, 1.0],
    [52, 37, 1.1],
    [70, 38, 1.05],
    [-88, 38, 1.1],
    [88, 38, 1.1],
    [-118, 38, 1.1],
    [118, 38, 1.1],
  ];
  for (const [px, pz, sc] of palmPositions) {
    const palm = createPalmTree(sc);
    palm.position.set(px, 0.02, pz);
    palm.rotation.y = (px * 0.7 + pz * 0.3) % (Math.PI * 2);
    group.add(palm);
  }

  // 9. Instanced Streetlights along Avenues
  const poleCoords: [number, number][] = [];
  for (let x = -120; x <= 120; x += 20) {
    poleCoords.push([x, 19.5], [x, 34.5], [x, -21.5], [x, -71.5], [x, -121.5]);
  }
  const lampCount = poleCoords.length;
  const lampPostGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.2, 6);
  const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x2b313a, metalness: 0.7, roughness: 0.35 });
  const lampPosts = new THREE.InstancedMesh(lampPostGeo, lampPostMat, lampCount);
  const lampHeadGeo = new THREE.BoxGeometry(0.6, 0.18, 0.35);
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xffe4a0,
    emissive: 0xffc65c,
    emissiveIntensity: 1.5,
  });
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampCount);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < lampCount; i++) {
    const [lx, lz] = poleCoords[i];
    dummy.position.set(lx, 3.1, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, 6.2, lz);
    dummy.updateMatrix();
    lampHeads.setMatrixAt(i, dummy.matrix);
  }
  lampPosts.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;
  lampPosts.computeBoundingSphere();
  lampHeads.computeBoundingSphere();
  group.add(lampPosts, lampHeads);

  // 10. Distant Cotonou Horizon Skyline Silhouettes
  const skylineGeo = new THREE.BoxGeometry(1, 1, 1);
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x4b5c6e, roughness: 0.85 });
  const skylineCount = 48;
  const skyline = new THREE.InstancedMesh(skylineGeo, skylineMat, skylineCount);
  for (let i = 0; i < skylineCount; i++) {
    const angle = Math.PI + (i / (skylineCount - 1)) * Math.PI;
    const dist = 180 + (i % 4) * 28;
    const h = 16 + ((i * 19) % 32);
    const w = 12 + ((i * 7) % 10);
    dummy.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist - 20);
    dummy.scale.set(w, h, w);
    dummy.updateMatrix();
    skyline.setMatrixAt(i, dummy.matrix);
  }
  skyline.instanceMatrix.needsUpdate = true;
  skyline.computeBoundingSphere();
  group.add(skyline);

  // Expanded Traffic & Police Patrol Loops
  const roadLoops: THREE.Vector3[][] = [
    [
      new THREE.Vector3(-116, 0, 24),
      new THREE.Vector3(116, 0, 24),
      new THREE.Vector3(116, 0, -28),
      new THREE.Vector3(-116, 0, -28),
    ],
    [
      new THREE.Vector3(68, 0, 30),
      new THREE.Vector3(-68, 0, 30),
      new THREE.Vector3(-68, 0, -128),
      new THREE.Vector3(68, 0, -128),
    ],
    [
      new THREE.Vector3(-116, 0, -78),
      new THREE.Vector3(116, 0, -78),
      new THREE.Vector3(116, 0, -128),
      new THREE.Vector3(-116, 0, -128),
    ],
  ];

  const getDistrictAt = (x: number, z: number): string => {
    if (z > 36) return 'Plage de Fidjrossè';
    if (z >= 19 && z <= 36) return 'Boulevard de la Marina';
    if (Math.abs(x) <= 32 && z >= -23 && z <= 19) return "Esplanade de l'Amazone";
    if (x < -60 && z >= -60 && z <= 20) return 'Port Autonome de Cotonou';
    if (x > 45 && z >= -75 && z <= -20) return 'Marché Dantokpa';
    if (x > 50 && z > -20) return 'Haie Vive / Akpakpa';
    return 'Quartier Ganhi';
  };

  return {
    group,
    colliders,
    oceanMaterial,
    oceanMesh,
    roadLoops,
    getDistrictAt,
  };
}
