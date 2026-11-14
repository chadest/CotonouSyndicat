/**
 * Composite 3–12+ part procedural 3D models for Cotonou Syndicat.
 * Features a faithful, realistic reconstruction of the Monument Amazone
 * based on the Cotonou Esplanade reference photographs, plus the Marina Hotel,
 * Palais des Congrès curved drums, Zémidjans, vehicles, characters, and palm trees.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CotonouTextures } from './textures';

export interface CharacterRig {
  group: THREE.Group;
  bodyParts: THREE.Mesh[];
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  muzzlePoint: THREE.Object3D;
  telegraphMesh?: THREE.Mesh;
}

export interface VehicleRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
  steeringWheel?: THREE.Object3D;
  cockpitAnchor?: THREE.Object3D;
  cockpitLookTarget?: THREE.Object3D;
  bodyMeshes: THREE.Mesh[];
  sirenRed?: THREE.Mesh;
  sirenBlue?: THREE.Mesh;
  sirenGlowRed?: THREE.Mesh;
  sirenGlowBlue?: THREE.Mesh;
  isMoto: boolean;
}

/**
 * Helper to create a soft radial contact shadow plane at y = 0.025.
 */
export function createContactShadow(
  texture: THREE.Texture,
  width: number,
  depth: number,
  opacity = 0.48,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.025;
  return mesh;
}

/**
 * Builds the realistic Monument Amazone of Cotonou by loading the imported 3D
 * sculpture (/white_mesh.glb) and applying a burnished bronze PBR material,
 * computed vertex normals, cylindrical patina UVs, and accurate terrace grounding.
 */
export function createAmazoneMonument(textures: CotonouTextures): THREE.Group {
  const group = new THREE.Group();

  const terraceStoneMat = new THREE.MeshStandardMaterial({
    map: textures.granite,
    color: 0xa49b8f,
    roughness: 0.84,
    metalness: 0.05,
  });

  const planterStoneMat = new THREE.MeshStandardMaterial({
    map: textures.granite,
    color: 0x867e74,
    roughness: 0.86,
    metalness: 0.06,
  });

  // Clone bronze patina texture with finer tiling for the full 25-unit statue
  const statueBronzeTex = textures.bronzePatina.clone();
  statueBronzeTex.repeat.set(4, 6);
  statueBronzeTex.needsUpdate = true;

  // Realistic burnished golden-bronze PBR material
  const realisticBronzeMat = new THREE.MeshPhysicalMaterial({
    map: statueBronzeTex,
    color: 0xc89e62,
    roughness: 0.30,
    metalness: 0.84,
    clearcoat: 0.25,
    clearcoatRoughness: 0.38,
    bumpMap: statueBronzeTex,
    bumpScale: 0.012,
    envMapIntensity: 1.35,
  });

  const bronzeTrimMat = new THREE.MeshStandardMaterial({
    map: textures.bronzePatina,
    color: 0xd1a96f,
    roughness: 0.28,
    metalness: 0.86,
  });

  const plaqueMat = new THREE.MeshStandardMaterial({
    color: 0x1b1917,
    roughness: 0.25,
    metalness: 0.7,
  });

  // 1. Low 3-step wide circular stone terrace (matches Cotonou Esplanade)
  const stepRadii = [12.4, 11.1, 9.8];
  stepRadii.forEach((rad, i) => {
    const step = new THREE.Mesh(
      new THREE.CylinderGeometry(rad, rad + 0.15, 0.32, 24),
      terraceStoneMat,
    );
    step.position.y = 0.16 + i * 0.32;
    step.receiveShadow = true;
    step.castShadow = true;
    group.add(step);
  });

  // Two flanking stone planter boxes with tropical shrubs
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 0.8 });
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xd9483b, roughness: 0.7 });
  for (const side of [-1, 1]) {
    const px = side * 10.6;
    const pz = 0.4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.05, 5.2), planterStoneMat);
    box.position.set(px, 0.55, pz);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    for (let b = 0; b < 7; b++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 + (b % 3) * 0.18, 1), leafMat);
      bush.position.set(
        px + (b % 2 === 0 ? -1 : 1) * 0.65,
        1.35 + (b % 2) * 0.25,
        pz - 1.6 + b * 0.54,
      );
      bush.castShadow = true;
      group.add(bush);
      if (b % 2 === 0) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), blossomMat);
        flower.position.set(bush.position.x + 0.25, bush.position.y + 0.55, bush.position.z);
        group.add(flower);
      }
    }
  }

  // Front dark bronze dedication plaque mounted at terrace edge
  const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.15, 0.32), bronzeTrimMat);
  plaqueFrame.position.set(0, 1.48, 5.35);
  plaqueFrame.castShadow = true;
  group.add(plaqueFrame);
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.92, 0.36), plaqueMat);
  plaque.position.set(0, 1.48, 5.38);
  group.add(plaque);

  // 2. Load the imported 3D sculpture (white_mesh.glb) & apply realistic bronze finish
  const loader = new GLTFLoader();
  loader.load(
    import.meta.env.BASE_URL + 'white_mesh.glb',
    (gltf) => {
      const model = gltf.scene;

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const geo = mesh.geometry;

          // Compute smooth vertex normals since raw mesh only contains POSITION
          geo.computeVertexNormals();

          // Generate cylindrical patina UVs if TEXCOORD_0 is absent
          if (!geo.attributes.uv && geo.attributes.position) {
            const pos = geo.attributes.position;
            geo.computeBoundingBox();
            const minY = geo.boundingBox?.min.y ?? -1;
            const spanY = Math.max(0.001, (geo.boundingBox?.max.y ?? 1) - minY);
            const uvs = new Float32Array(pos.count * 2);
            for (let i = 0; i < pos.count; i++) {
              const vx = pos.getX(i);
              const vy = pos.getY(i);
              const vz = pos.getZ(i);
              uvs[i * 2] = Math.atan2(vx, vz) / (Math.PI * 2) + 0.5;
              uvs[i * 2 + 1] = (vy - minY) / spanY;
            }
            geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
          }

          mesh.material = realisticBronzeMat;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      // Orient statue to face South (+Z) toward Boulevard de la Marina & Atlantic Ocean
      model.rotation.y = Math.PI;
      model.updateMatrixWorld(true);

      // Scale uniformly to monumental 25-unit Cotonou Esplanade height
      const initialBox = new THREE.Box3().setFromObject(model);
      const initialSize = new THREE.Vector3();
      initialBox.getSize(initialSize);
      const scaleFactor = 25.0 / Math.max(0.001, initialSize.y);
      model.scale.setScalar(scaleFactor);
      model.updateMatrixWorld(true);

      // Center on X/Z and rest base flush on the 3-step terrace (y = 0.94)
      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      scaledBox.getCenter(center);
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y += 0.94 - scaledBox.min.y;

      group.add(model);
    },
    undefined,
    (error) => {
      console.error('Erreur de chargement du modèle /white_mesh.glb :', error);
    },
  );

  return group;
}

/**
 * Builds the modern curved beachfront Marina Hotel (Sofitel Cotonou)
 * visible on the right horizon in the Esplanade reference photographs.
 */
export function createMarinaHotel(textures: CotonouTextures): THREE.Group {
  const group = new THREE.Group();

  const whiteStoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd3,
    roughness: 0.65,
    metalness: 0.06,
  });
  const glassRibbonMat = new THREE.MeshStandardMaterial({
    map: textures.buildingModern,
    color: 0x3b5268,
    roughness: 0.18,
    metalness: 0.68,
  });
  const travertineWingMat = new THREE.MeshStandardMaterial({
    color: 0xb7aa98,
    roughness: 0.78,
  });

  // Main 5-story stepped hotel block
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(36, 16, 16), glassRibbonMat);
  mainBody.position.y = 8;
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  group.add(mainBody);

  // Horizontal white architectural floor slabs
  for (let floor = 0; floor <= 5; floor++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(36.8, 0.65, 16.8), whiteStoneMat);
    slab.position.y = floor * 3.2;
    group.add(slab);
  }

  // Flanking stone tower wings (characteristic silhouette in reference photo 1 & 3)
  for (const sx of [-15, 15]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7.2, 18.5, 17.5), travertineWingMat);
    wing.position.set(sx, 9.25, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
    group.add(wing);
  }

  // Lower podium terrace
  const podium = new THREE.Mesh(new THREE.BoxGeometry(44, 3.2, 22), whiteStoneMat);
  podium.position.set(0, 1.6, 2);
  podium.receiveShadow = true;
  group.add(podium);

  return group;
}

/**
 * Builds the iconic slanted white curved cultural drums of the Palais des Congrès
 * visible behind the Monument Amazone in the 2nd reference photograph.
 */
export function createPalaisDesCongres(): THREE.Group {
  const group = new THREE.Group();

  const whiteConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xebe6dd,
    roughness: 0.62,
    metalness: 0.05,
  });
  const windowBandMat = new THREE.MeshStandardMaterial({
    color: 0x26323d,
    roughness: 0.25,
    metalness: 0.5,
  });

  // Primary large slanted white architectural drum
  const drum1 = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 15, 24), whiteConcreteMat);
  drum1.position.set(-10, 7.5, 0);
  drum1.castShadow = true;
  drum1.receiveShadow = true;
  group.add(drum1);

  const roof1 = new THREE.Mesh(new THREE.CylinderGeometry(12.4, 12.4, 1.2, 24), whiteConcreteMat);
  roof1.position.set(-10, 15.2, 0);
  roof1.rotation.z = -0.22;
  group.add(roof1);

  const glassBand1 = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 13.4, 2.2, 24), windowBandMat);
  glassBand1.position.set(-10, 4.2, 0);
  group.add(glassBand1);

  // Secondary elliptical drum connected via central gallery
  const drum2 = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.5, 11, 20), whiteConcreteMat);
  drum2.position.set(12, 5.5, 2);
  drum2.castShadow = true;
  drum2.receiveShadow = true;
  group.add(drum2);

  const roof2 = new THREE.Mesh(new THREE.CylinderGeometry(8.8, 8.8, 1.0, 20), whiteConcreteMat);
  roof2.position.set(12, 11.1, 2);
  roof2.rotation.z = 0.18;
  group.add(roof2);

  const gallery = new THREE.Mesh(new THREE.BoxGeometry(16, 6.5, 10), whiteConcreteMat);
  gallery.position.set(1, 3.25, 1);
  gallery.castShadow = true;
  group.add(gallery);

  return group;
}

/**
 * Builds the sleek dark-steel Esplanade floodlight mast seen around the plaza.
 */
export function createEsplanadeFloodlightPole(): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36,
    roughness: 0.38,
    metalness: 0.82,
  });
  const podMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.8,
  });

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.17, 11.5, 8), steelMat);
  mast.position.y = 5.75;
  mast.castShadow = true;
  group.add(mast);

  for (const py of [8.2, 9.8, 11.1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.42), podMat);
    pod.position.set(0, py, 0.22);
    pod.rotation.x = 0.25;
    group.add(pod);
  }
  return group;
}

/**
 * Builds an anatomically sculpted, articulated human rig (zero blocky boxes)
 * for Koffi (player), Rival Gangsters, Cotonou Police Officers, and Civilians.
 */
export function createCharacterRig(
  role: 'player' | 'enemy' | 'police' | 'civilian',
  textures: CotonouTextures,
  variant = 0,
): CharacterRig {
  const group = new THREE.Group();
  const bodyParts: THREE.Mesh[] = [];

  // Authentic West African skin tones & clothing palettes
  const skinTones = [0x543524, 0x6b452d, 0x3e2517, 0x7c5035];
  const skinHex = role === 'player' ? 0x523423 : skinTones[variant % skinTones.length];
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.56,
    metalness: 0.04,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x161414,
    roughness: 0.88,
    metalness: 0.02,
  });

  const civilianShirts = [0xd97706, 0x0f766e, 0xb91c1c, 0x1d4ed8, 0xeab308, 0xf3efe6];
  const civilianPants = [0x1f2937, 0x292524, 0x334155, 0x1e293b];

  const pantsColor =
    role === 'player'
      ? 0x181d26
      : role === 'police'
        ? 0x16253b
        : role === 'enemy'
          ? 0x241f1c
          : civilianPants[variant % civilianPants.length];

  const jacketColor =
    role === 'player'
      ? 0xd69624
      : role === 'police'
        ? 0x1d3b61
        : role === 'enemy'
          ? 0x9b2226
          : civilianShirts[variant % civilianShirts.length];

  const accentColor =
    role === 'player'
      ? 0x14171d
      : role === 'police'
        ? 0xeab308
        : role === 'enemy'
          ? 0x1c1917
          : 0x27272a;

  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.82, metalness: 0.04 });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: role === 'player' ? 0.45 : 0.68,
    metalness: role === 'player' ? 0.14 : 0.06,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: role === 'player' ? 0xf3efe6 : role === 'police' ? 0x264b78 : 0x22252b,
    roughness: 0.78,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.3 });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: role === 'player' ? 0xf5f2eb : 0x1a1c21,
    roughness: 0.55,
    metalness: 0.08,
  });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.85 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.28, metalness: 0.88 });

  group.add(createContactShadow(textures.contactShadow, 1.15, 1.15, 0.42));

  // --- Sculpted Legs (Thigh -> Knee -> Calf -> Ankle -> Contoured Sneaker/Boot) ---
  const makeLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.88, 0);

    const hip = new THREE.Mesh(new THREE.SphereGeometry(0.112, 10, 8), pantsMat);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.086, 0.42, 12), pantsMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), pantsMat);
    knee.position.y = -0.42;

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.06, 0.38, 12), pantsMat);
    calf.position.y = -0.61;
    calf.castShadow = true;

    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.054, 0.07, 10), pantsMat);
    ankle.position.y = -0.80;

    // Rounded shoe upper + rubber outsole (no boxy feet)
    const shoeUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.14, 6, 10), shoeMat);
    shoeUpper.rotation.x = Math.PI / 2;
    shoeUpper.scale.set(0.95, 1, 0.78);
    shoeUpper.position.set(0, -0.835, 0.048);
    shoeUpper.castShadow = true;

    const shoeSole = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.148, 4, 10), soleMat);
    shoeSole.rotation.x = Math.PI / 2;
    shoeSole.scale.set(1.0, 1.02, 0.34);
    shoeSole.position.set(0, -0.865, 0.048);

    legPivot.add(hip, thigh, knee, calf, ankle, shoeUpper, shoeSole);
    bodyParts.push(thigh, calf, shoeUpper);
    group.add(legPivot);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);

  // --- Sculpted Athletic Torso & Pelvis using LatheGeometry ---
  const torsoProfile = [
    new THREE.Vector2(0.01, 0.84),
    new THREE.Vector2(0.145, 0.87),
    new THREE.Vector2(0.165, 0.96),
    new THREE.Vector2(0.142, 1.12),
    new THREE.Vector2(0.188, 1.34),
    new THREE.Vector2(0.205, 1.46),
    new THREE.Vector2(0.115, 1.54),
    new THREE.Vector2(0.01, 1.56),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 16);
  const torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.scale.set(1.16, 1.0, 0.72);
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);
  bodyParts.push(torso);

  // Inner shirt V-front & collar detail
  const innerShirt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.32, 10), shirtMat);
  innerShirt.scale.set(1.0, 1, 0.65);
  innerShirt.position.set(0, 1.36, 0.095);
  group.add(innerShirt);
  bodyParts.push(innerShirt);

  // Contoured waist belt & metallic buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.168, 0.065, 16), accentMat);
  belt.scale.set(1.16, 1, 0.74);
  belt.position.y = 0.95;
  group.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.88, roughness: 0.2 }),
  );
  buckle.rotation.x = Math.PI / 2;
  buckle.position.set(0, 0.95, 0.128);
  group.add(buckle);

  if (role === 'police') {
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.24 });
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.014, 6), goldMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.09, 1.37, 0.145);
    group.add(badge);
    for (const sx of [-0.21, 0.21]) {
      const ep = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.06, 4, 6), goldMat);
      ep.rotation.z = Math.PI / 2;
      ep.position.set(sx, 1.505, 0);
      group.add(ep);
    }
  }

  // --- Sculpted Neck, Cranium, Jaw, Ears, Nose & Eyes ---
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.084, 0.15, 12), skinMat);
  neck.position.y = 1.58;
  neck.castShadow = true;
  group.add(neck);
  bodyParts.push(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.77, 0);
  group.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), skinMat);
  cranium.scale.set(0.92, 1.08, 1.02);
  cranium.castShadow = true;
  headGroup.add(cranium);
  bodyParts.push(cranium);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.102, 12, 10), skinMat);
  jaw.scale.set(0.84, 0.92, 0.95);
  jaw.position.set(0, -0.072, 0.034);
  headGroup.add(jaw);
  bodyParts.push(jaw);

  const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.036, 4, 8), skinMat);
  nose.rotation.x = -0.25;
  nose.position.set(0, -0.015, 0.146);
  headGroup.add(nose);

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), skinMat);
    ear.scale.set(0.45, 1.15, 0.78);
    ear.position.set(side * 0.132, -0.01, -0.005);
    headGroup.add(ear);
  }

  // Sculpted hair cap
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat,
  );
  hairCap.scale.set(0.93, 1.08, 1.03);
  hairCap.position.set(0, 0.015, -0.006);
  hairCap.rotation.x = -0.15;
  headGroup.add(hairCap);

  if (role === 'player') {
    // Sleek curved wraparound sunglasses for Koffi
    const shades = new THREE.Mesh(
      new THREE.CylinderGeometry(0.146, 0.146, 0.048, 16, 1, true, -0.68, 1.36),
      new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.12, metalness: 0.85, side: THREE.DoubleSide }),
    );
    shades.position.set(0, 0.018, 0.012);
    headGroup.add(shades);
  } else {
    // Realistic eyes for NPCs
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.25 });
    for (const sx of [-0.046, 0.046]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), eyeMat);
      eye.position.set(sx, 0.016, 0.134);
      headGroup.add(eye);
    }
  }

  if (role === 'police') {
    // Officer peaked cap
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.095, 16), jacketMat);
    capCrown.position.set(0, 0.125, -0.005);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.165, 0.016, 14, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      soleMat,
    );
    visor.position.set(0, 0.085, 0.045);
    visor.rotation.x = 0.14;
    headGroup.add(capCrown, visor);
  } else if (role === 'enemy') {
    // Crimson bandana headband
    const bandana = new THREE.Mesh(
      new THREE.TorusGeometry(0.138, 0.022, 8, 18),
      jacketMat,
    );
    bandana.rotation.x = Math.PI / 2 + 0.12;
    bandana.position.set(0, 0.06, -0.005);
    headGroup.add(bandana);
  } else if (role === 'civilian' && variant % 3 === 1) {
    // Woven Cotonou brimmed hat or top bun
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hairMat);
    bun.position.set(0, 0.155, -0.04);
    headGroup.add(bun);
  }

  // --- Sculpted Articulated Arms (Shoulder -> Bicep -> Elbow -> Forearm -> Hand) ---
  const armClothMat = role === 'civilian' && variant % 2 === 1 ? skinMat : jacketMat;
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.275, 1.46, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.078, 10, 8), jacketMat);
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.058, 0.27, 10), armClothMat);
    upperArm.position.y = -0.135;
    upperArm.castShadow = true;

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.056, 8, 8), armClothMat);
    elbow.position.y = -0.27;

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.042, 0.25, 10), skinMat);
    forearm.position.y = -0.395;
    forearm.castShadow = true;

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.046, 8, 8), skinMat);
    hand.scale.set(0.82, 1.15, 0.65);
    hand.position.y = -0.53;

    armPivot.add(shoulder, upperArm, elbow, forearm, hand);
    bodyParts.push(shoulder, upperArm, forearm, hand);
    group.add(armPivot);
    return armPivot;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, -0.54, 0.44);
  rightArm.add(muzzlePoint);

  // Armed characters hold a sculpted pistol; civilians walk empty-handed
  if (role !== 'civilian') {
    const gunGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.12, 8), gunMat);
    gunGrip.position.set(0, -0.53, 0.04);
    gunGrip.rotation.x = 0.22;

    const gunSlide = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.22, 4, 8), gunMat);
    gunSlide.rotation.x = Math.PI / 2;
    gunSlide.position.set(0, -0.49, 0.16);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), gunMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(0, -0.49, 0.30);

    rightArm.add(gunGrip, gunSlide, gunBarrel);
    rightArm.rotation.x = -Math.PI / 2.2;
  }

  let telegraphMesh: THREE.Mesh | undefined;
  if (role === 'enemy' || role === 'police') {
    const tGeo = new THREE.RingGeometry(0.55, 0.72, 20);
    tGeo.rotateX(-Math.PI / 2);
    const tMat = new THREE.MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    telegraphMesh = new THREE.Mesh(tGeo, tMat);
    telegraphMesh.position.y = 0.05;
    group.add(telegraphMesh);
  }

  return {
    group,
    bodyParts,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    muzzlePoint,
    telegraphMesh,
  };
}

/**
 * Builds an iconic Cotonou Zémidjan (yellow moto-taxi) with steerable front fork & rider cam.
 */
export function createZemidjan(textures: CotonouTextures): VehicleRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];
  const bodyMeshes: THREE.Mesh[] = [];

  const yellowMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4b41a,
    roughness: 0.28,
    metalness: 0.25,
    clearcoat: 0.85,
  });
  const blackSeatMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.82, metalness: 0.08 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd0d5dd, roughness: 0.18, metalness: 0.92 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.9, metalness: 0.05 });

  group.add(createContactShadow(textures.contactShadow, 1.5, 3.0, 0.5));

  // Rear wheel
  const rearWheelPivot = new THREE.Group();
  rearWheelPivot.position.set(0, 0.38, -0.88);
  const rTire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 20), tireMat);
  rTire.rotation.y = Math.PI / 2;
  rTire.castShadow = true;
  const rRim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), chromeMat);
  rRim.rotation.z = Math.PI / 2;
  rearWheelPivot.add(rTire, rRim);
  wheels.push(rearWheelPivot);
  group.add(rearWheelPivot);

  // Front steering assembly (fork + handlebar + headlight + front wheel)
  const frontAssembly = new THREE.Group();
  frontAssembly.position.set(0, 0, 0.68);
  frontSteerPivots.push(frontAssembly);
  group.add(frontAssembly);

  const frontWheelPivot = new THREE.Group();
  frontWheelPivot.position.set(0, 0.38, 0.2);
  const fTire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 10, 20), tireMat);
  fTire.rotation.y = Math.PI / 2;
  fTire.castShadow = true;
  const fRim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), chromeMat);
  fRim.rotation.z = Math.PI / 2;
  frontWheelPivot.add(fTire, fRim);
  wheels.push(frontWheelPivot);
  frontAssembly.add(frontWheelPivot);

  const frontFender = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.09, 0.52), yellowMat);
  frontFender.position.set(0, 0.72, 0.17);
  frontFender.rotation.x = 0.25;
  frontAssembly.add(frontFender);

  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.85, 8), chromeMat);
  fork.position.set(0, 0.82, 0.04);
  fork.rotation.x = -0.32;
  frontAssembly.add(fork);

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.84, 8), chromeMat);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.18, -0.1);
  frontAssembly.add(handlebar);

  const headlight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd269, emissiveIntensity: 1.4 }),
  );
  headlight.rotation.x = Math.PI / 2;
  headlight.position.set(0, 1.04, 0.04);
  frontAssembly.add(headlight);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.72), chromeMat);
  engine.position.set(0, 0.48, 0.0);
  engine.castShadow = true;
  group.add(engine);
  bodyMeshes.push(engine);

  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 6, 12), yellowMat);
  tank.rotation.x = Math.PI / 2;
  tank.position.set(0, 0.92, 0.24);
  tank.castShadow = true;
  group.add(tank);
  bodyMeshes.push(tank);

  const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.62, 6, 10), blackSeatMat);
  seat.rotation.x = Math.PI / 2;
  seat.scale.set(1.1, 1, 0.55);
  seat.position.set(0, 0.92, -0.35);
  seat.castShadow = true;
  group.add(seat);

  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.36), chromeMat);
  rack.position.set(0, 0.96, -0.92);
  group.add(rack);

  // First-person rider cockpit camera anchor
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0, 1.56, -0.12);
  group.add(cockpitAnchor);

  const cockpitLookTarget = new THREE.Object3D();
  cockpitLookTarget.position.set(0, 1.44, 14);
  group.add(cockpitLookTarget);

  return {
    group,
    wheels,
    frontSteerPivots,
    cockpitAnchor,
    cockpitLookTarget,
    bodyMeshes,
    isMoto: true,
  };
}

/**
 * Builds a realistic sedan or Police Brigade 4x4 with a hollowed cabin,
 * detailed dashboard, illuminated gauges, rotating steering wheel, bucket seats,
 * transparent windshield/windows, steerable front wheels, and cockpit cam anchor.
 */
export function createCar(
  colorHex: number,
  isPolice: boolean,
  textures: CotonouTextures,
): VehicleRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];
  const bodyMeshes: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.24,
    metalness: 0.45,
    clearcoat: 0.95,
    clearcoatRoughness: 0.12,
  });

  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x1b1e24,
    roughness: 0.85,
    metalness: 0.08,
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x2a2522,
    roughness: 0.78,
    metalness: 0.05,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8d0e6,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x181b20,
    roughness: 0.65,
    metalness: 0.25,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd0d6de,
    roughness: 0.22,
    metalness: 0.9,
  });

  group.add(createContactShadow(textures.contactShadow, 2.7, 5.1, 0.55));

  // --- 1. Open Lower Chassis (Floor pan, Hood, Trunk, Side Doors & Fenders) ---
  const floorPan = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 4.32), trimMat);
  floorPan.position.set(0, 0.42, 0);
  floorPan.castShadow = true;
  floorPan.receiveShadow = true;
  group.add(floorPan);

  // Sculpted front hood sloping slightly forward (+Z)
  const frontHood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.46, 1.48), paintMat);
  frontHood.position.set(0, 0.72, 1.46);
  frontHood.rotation.x = 0.05;
  frontHood.castShadow = true;
  frontHood.receiveShadow = true;
  group.add(frontHood);
  bodyMeshes.push(frontHood);

  // Front grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.08), trimMat);
  grille.position.set(0, 0.66, 2.21);
  group.add(grille);

  // Rear trunk deck (-Z)
  const rearTrunk = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.48, 1.12), paintMat);
  rearTrunk.position.set(0, 0.74, -1.62);
  rearTrunk.castShadow = true;
  rearTrunk.receiveShadow = true;
  group.add(rearTrunk);
  bodyMeshes.push(rearTrunk);

  // Left & Right Door Panels leaving the interior cabin open!
  for (const sx of [-0.84, 0.84]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 1.98), paintMat);
    door.position.set(sx, 0.73, -0.15);
    door.castShadow = true;
    door.receiveShadow = true;
    group.add(door);
    bodyMeshes.push(door);

    // Side wing mirrors outside A-pillar
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), paintMat);
    mirror.position.set(sx + Math.sign(sx) * 0.13, 1.04, 0.64);
    group.add(mirror);
  }

  // Front & Rear Bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 0.2), trimMat);
  frontBumper.position.set(0, 0.44, 2.18);
  group.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 0.2), trimMat);
  rearBumper.position.set(0, 0.44, -2.18);
  group.add(rearBumper);

  // --- 2. Detailed Car Interior (Visible from Outside & in First-Person Cockpit View) ---
  // Dashboard & Center Console
  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.34, 0.44), interiorMat);
  dashboard.position.set(0, 0.92, 0.62);
  group.add(dashboard);

  const instrumentHood = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.22), interiorMat);
  instrumentHood.position.set(0.38, 1.10, 0.58);
  group.add(instrumentHood);

  // Illuminated Speedometer & Tachometer Gauges (Left-hand drive: +X when facing +Z)
  const gaugeDialMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
  });
  for (const gx of [0.29, 0.47]) {
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.02, 14), gaugeDialMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(gx, 1.08, 0.475);
    group.add(dial);
  }

  // Center infotainment screen
  const navScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.15, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xeab308, emissiveIntensity: 0.55 }),
  );
  navScreen.position.set(0, 1.05, 0.46);
  group.add(navScreen);

  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 1.15), interiorMat);
  consoleBox.position.set(0, 0.64, -0.05);
  group.add(consoleBox);

  // Steering column & Rotating Steering Wheel (at x = +0.38, driver's left side facing +Z)
  const steerColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 10), trimMat);
  steerColumn.rotation.x = Math.PI / 2 - 0.35;
  steerColumn.position.set(0.38, 0.98, 0.42);
  group.add(steerColumn);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(0.38, 1.04, 0.31);
  steeringWheel.rotation.x = -0.32;
  group.add(steeringWheel);

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.02, 8, 22), trimMat);
  steeringWheel.add(wheelRim);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 12), interiorMat);
  wheelHub.rotation.x = Math.PI / 2;
  steeringWheel.add(wheelHub);
  for (const angle of [0, -Math.PI * 0.72, Math.PI * 0.72]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.14, 0.018), trimMat);
    spoke.position.set(Math.sin(angle) * 0.08, -Math.cos(angle) * 0.08, 0);
    spoke.rotation.z = angle;
    steeringWheel.add(spoke);
  }

  // Front Bucket Seats + Headrests & Rear Bench
  for (const sx of [-0.4, 0.4]) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.52), seatMat);
    cushion.position.set(sx, 0.56, -0.14);
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.14), seatMat);
    backrest.position.set(sx, 0.86, -0.36);
    backrest.rotation.x = -0.16;
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.1), seatMat);
    headrest.position.set(sx, 1.21, -0.41);
    group.add(cushion, backrest, headrest);
  }
  const rearBench = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.42, 0.44), seatMat);
  rearBench.position.set(0, 0.72, -0.94);
  group.add(rearBench);

  // --- 3. Roof, A/B/C Pillars & Transparent Glass ---
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.08, 1.56), paintMat);
  roof.position.set(0, 1.56, -0.32);
  roof.castShadow = true;
  group.add(roof);
  bodyMeshes.push(roof);

  // Interior rear-view mirror
  const interiorMirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.04), trimMat);
  interiorMirror.position.set(0, 1.46, 0.42);
  group.add(interiorMirror);

  // Angled A-Pillars (Front windshield frame)
  for (const sx of [-0.81, 0.81]) {
    const aPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.72, 8), paintMat);
    aPillar.position.set(sx, 1.26, 0.61);
    aPillar.rotation.x = -0.64;
    group.add(aPillar);

    const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.1), trimMat);
    bPillar.position.set(sx, 1.26, -0.32);
    group.add(bPillar);

    const cPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.74, 8), paintMat);
    cPillar.position.set(sx, 1.25, -1.24);
    cPillar.rotation.x = 0.72;
    group.add(cPillar);
  }

  // Front Windshield & Side/Rear Transparent Windows
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.72), glassMat);
  windshield.position.set(0, 1.26, 0.62);
  windshield.rotation.x = -0.92;
  group.add(windshield);

  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.74), glassMat);
  rearGlass.position.set(0, 1.25, -1.25);
  rearGlass.rotation.x = 0.85;
  group.add(rearGlass);

  for (const sx of [-0.82, 0.82]) {
    const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.54), glassMat);
    sideGlass.position.set(sx, 1.26, -0.32);
    sideGlass.rotation.y = Math.PI / 2;
    group.add(sideGlass);
  }

  // Headlights & Taillights
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d6,
    emissive: 0xffe49e,
    emissiveIntensity: 1.4,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0xd9261c,
    emissiveIntensity: 1.2,
  });

  for (const sx of [-0.66, 0.66]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), headMat);
    hl.position.set(sx, 0.72, 2.21);
    group.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), tailMat);
    tl.position.set(sx, 0.75, -2.20);
    group.add(tl);
  }

  // --- 4. Steerable Front Wheels & Rolling Rear Wheels ---
  const wheelPositions: [number, number, boolean][] = [
    [-0.93, 1.38, true],
    [0.93, 1.38, true],
    [-0.93, -1.38, false],
    [0.93, -1.38, false],
  ];
  for (const [wx, wz, isFront] of wheelPositions) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(wx, 0.38, wz);

    const spinPivot = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 18), trimMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    spinPivot.add(tire, rim);

    steerPivot.add(spinPivot);
    group.add(steerPivot);
    wheels.push(spinPivot);
    if (isFront) {
      frontSteerPivots.push(steerPivot);
    }
  }

  // --- 5. Police Républicaine du Bénin Livery & Glowing Gyrophares ---
  let sirenRed: THREE.Mesh | undefined;
  let sirenBlue: THREE.Mesh | undefined;
  let sirenGlowRed: THREE.Mesh | undefined;
  let sirenGlowBlue: THREE.Mesh | undefined;
  if (isPolice) {
    const doorDecalMat = new THREE.MeshStandardMaterial({
      map: textures.policeDoorDecal,
      roughness: 0.42,
      metalness: 0.08,
    });
    for (const sx of [-0.906, 0.906]) {
      const doorPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.76, 0.42), doorDecalMat);
      doorPlate.position.set(sx, 0.74, -0.15);
      doorPlate.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(doorPlate);
    }

    // Benin tricolor stripe across hood edge (green, yellow, red)
    const beninColors = [0x008751, 0xfcd116, 0xe8112d];
    beninColors.forEach((col, i) => {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.025, 0.28),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 }),
      );
      strip.position.set(-0.56 + i * 0.56, 0.965, 1.82);
      strip.rotation.x = 0.05;
      group.add(strip);
    });

    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.09, 0.30), trimMat);
    barBase.position.set(0, 1.63, -0.22);
    group.add(barBase);

    sirenRed = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.30, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2d20, emissive: 0xff2d20, emissiveIntensity: 0.2 }),
    );
    sirenRed.rotation.z = Math.PI / 2;
    sirenRed.position.set(-0.32, 1.72, -0.22);
    group.add(sirenRed);

    sirenBlue = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.30, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x3b82f6, emissiveIntensity: 0.2 }),
    );
    sirenBlue.rotation.z = Math.PI / 2;
    sirenBlue.position.set(0.32, 1.72, -0.22);
    group.add(sirenBlue);

    // Optical glow halos visible around gyrophares during active shootout response
    sirenGlowRed = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    sirenGlowRed.position.copy(sirenRed.position);
    group.add(sirenGlowRed);

    sirenGlowBlue = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 10, 8),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    sirenGlowBlue.position.copy(sirenBlue.position);
    group.add(sirenGlowBlue);
  }

  // --- 6. First-Person Driver Cockpit Anchor & Forward Target ---
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(0.38, 1.24, -0.06);
  group.add(cockpitAnchor);

  const cockpitLookTarget = new THREE.Object3D();
  cockpitLookTarget.position.set(0.38, 1.12, 16);
  group.add(cockpitLookTarget);

  return {
    group,
    wheels,
    frontSteerPivots,
    steeringWheel,
    cockpitAnchor,
    cockpitLookTarget,
    bodyMeshes,
    sirenRed,
    sirenBlue,
    sirenGlowRed,
    sirenGlowBlue,
    isMoto: false,
  };
}

/**
 * Builds a coastal Cotonou coconut palm tree (curved trunk + 7 arched fronds + coconuts).
 */
export function createPalmTree(scale = 1): THREE.Group {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x725840, roughness: 0.92, metalness: 0.02 });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.75 });

  const segments = 6;
  const segH = 1.25;
  let topX = 0;
  let topY = 0;
  for (let i = 0; i < segments; i++) {
    const rBot = 0.34 - i * 0.03;
    const rTop = 0.31 - i * 0.03;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 8), trunkMat);
    const lean = i * 0.16;
    seg.position.set(lean, i * segH + segH * 0.5, 0);
    seg.rotation.z = -0.07;
    seg.castShadow = true;
    group.add(seg);
    topX = lean + 0.08;
    topY = (i + 1) * segH;
  }

  const crown = new THREE.Group();
  crown.position.set(topX, topY, 0);
  group.add(crown);

  for (let c = 0; c < 3; c++) {
    const ca = (c * Math.PI * 2) / 3;
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), coconutMat);
    coco.position.set(Math.cos(ca) * 0.28, -0.18, Math.sin(ca) * 0.28);
    crown.add(coco);
  }

  const frondShape = new THREE.Shape();
  frondShape.moveTo(0, 0);
  frondShape.quadraticCurveTo(1.6, 0.55, 3.2, -0.35);
  frondShape.quadraticCurveTo(1.6, -0.05, 0, -0.18);
  frondShape.closePath();
  const frondGeo = new THREE.ExtrudeGeometry(frondShape, { depth: 0.05, bevelEnabled: false });

  for (let f = 0; f < 7; f++) {
    const angle = (f * Math.PI * 2) / 7;
    const frondPivot = new THREE.Group();
    frondPivot.rotation.y = angle;
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.rotation.x = 0.2;
    frond.rotation.z = -0.15;
    frond.castShadow = true;
    frondPivot.add(frond);
    crown.add(frondPivot);
  }

  group.scale.setScalar(scale);
  return group;
}

/**
 * Builds a multi-story Cotonou building with facade texture, ground awning,
 * roof cornice, and rooftop details.
 */
export function createCotonouBuilding(
  width: number,
  height: number,
  depth: number,
  style: 'warm' | 'terracotta' | 'modern',
  textures: CotonouTextures,
): THREE.Group {
  const group = new THREE.Group();

  const facadeTex =
    style === 'warm'
      ? textures.buildingWarm
      : style === 'terracotta'
        ? textures.buildingTerracotta
        : textures.buildingModern;

  const wallMat = new THREE.MeshStandardMaterial({
    map: facadeTex,
    roughness: style === 'modern' ? 0.35 : 0.78,
    metalness: style === 'modern' ? 0.3 : 0.06,
  });

  const trimColor = style === 'modern' ? 0x26313d : style === 'terracotta' ? 0x7c3b27 : 0x9b886b;
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.72, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.55, depth + 0.5), trimMat);
  cornice.position.y = height + 0.2;
  cornice.castShadow = true;
  group.add(cornice);

  const awningColor = style === 'terracotta' ? 0xd97706 : style === 'warm' ? 0x15803d : 0x1d4ed8;
  const awningMat = new THREE.MeshStandardMaterial({ color: awningColor, roughness: 0.65 });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.25, 1.4), awningMat);
  awning.position.set(0, 3.2, depth / 2 + 0.65);
  awning.rotation.x = 0.22;
  awning.castShadow = true;
  group.add(awning);

  const tankMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.4 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10), tankMat);
  tank.position.set(width * 0.22, height + 1.1, -depth * 0.18);
  group.add(tank);

  return group;
}

/**
 * Builds a colorful Dantokpa-style street market stall.
 */
export function createMarketStall(canopyColor: number): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.72 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0xc89b54, roughness: 0.8 });

  const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.6), woodMat);
  table.position.y = 0.45;
  table.castShadow = true;
  table.receiveShadow = true;
  group.add(table);

  for (const sx of [-1.45, 1.45]) {
    for (const sz of [-0.65, 0.65]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), woodMat);
      post.position.set(sx, 1.25, sz);
      group.add(post);
    }
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 2.2), canopyMat);
  roof.position.y = 2.55;
  roof.rotation.x = 0.12;
  roof.castShadow = true;
  group.add(roof);

  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.6), crateMat);
  crate.position.set(-0.7, 1.15, 0.1);
  group.add(crate);

  return group;
}
/**
 * Builds the fully immersive 3D Tribunal de Cotonou courtroom scene for trial proceedings,
 * complete with 3D judges, prosecutor, defense counsel, accused, audience, and Beninese flag.
 */
export function createCourtroomScene(): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.65 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x221a14, roughness: 0.7 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a433b, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
  const robeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x543524, roughness: 0.55 });
  const benchSeatMat = new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: 0.8 });

  // Courtroom floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Back wall & Side walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(36, 14, 0.6), wallMat);
  backWall.position.set(0, 7, -17);
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 14, 36), wallMat);
  leftWall.position.set(-18, 7, 0);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 14, 36), wallMat);
  rightWall.position.set(18, 7, 0);
  group.add(rightWall);

  // Raised Judge's Bench & Podium
  const podium = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 4.5), woodMat);
  podium.position.set(0, 0.6, -12);
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  const judgeDesk = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 2.4), woodMat);
  judgeDesk.position.set(0, 2.3, -12);
  judgeDesk.castShadow = true;
  group.add(judgeDesk);

  // 3 Seated 3D Judges behind the bench
  for (let j = -1; j <= 1; j++) {
    const judgeGroup = new THREE.Group();
    judgeGroup.position.set(j * 2.5, 2.7, -12.4);
    
    // Judge torso/robe
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.1, 10), robeMat);
    torso.position.y = 0.55;
    
    // Judge head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
    head.position.set(0, 1.25, 0);
    
    // Judicial red sash / collar
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.08), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    sash.position.set(0, 0.55, 0.18);
    sash.rotation.z = j * 0.15;

    judgeGroup.add(torso, head, sash);
    group.add(judgeGroup);
  }

  // Beninese Flag behind the judges
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8, 8), brassMat);
  flagPole.position.set(0, 4, -15.5);
  group.add(flagPole);

  const green = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x008751 }));
  green.position.set(-0.8, 6.2, -15.45);
  const yellow = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xfcd116 }));
  yellow.position.set(0.4, 6.45, -15.45);
  const red = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xe8112d }));
  red.position.set(0.4, 5.95, -15.45);
  group.add(green, yellow, red);

  // Prosecution Table (left) & Defense Table (right) with Lawyers
  for (const [side, label, lawyerX] of [[-1, 'Prosecution', -5.5], [1, 'Defense', 5.5]] as const) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 2.2), woodMat);
    table.position.set(lawyerX, 0.55, -5);
    table.castShadow = true;
    group.add(table);

    // Lawyer 3D character
    const lawyerGroup = new THREE.Group();
    lawyerGroup.position.set(lawyerX, 0, -6.2);
    lawyerGroup.rotation.y = side < 0 ? Math.PI / 6 : -Math.PI / 6;
    const lBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.3, 10), robeMat);
    lBody.position.y = 0.65;
    const lHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skinMat);
    lHead.position.set(0, 1.4, 0);
    lawyerGroup.add(lBody, lHead);
    group.add(lawyerGroup);
  }

  // Defendant Dock at Center (z = -1) where accused Koffi stands
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.8), woodMat);
  dock.position.set(0, 0.55, -1);
  dock.castShadow = true;
  group.add(dock);

  // Audience Gallery Benches at the back (z = 6 to 12)
  for (let row = 0; row < 3; row++) {
    const rz = 6 + row * 3.2;
    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 1.2), benchSeatMat);
    benchSeat.position.set(0, 0.3, rz);
    benchSeat.castShadow = true;
    group.add(benchSeat);

    // Spectators in audience
    for (let seatIdx = -3; seatIdx <= 3; seatIdx += 2) {
      const spec = new THREE.Group();
      spec.position.set(seatIdx * 2.1, 0.6, rz);
      const sBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x2b3748 }));
      sBody.position.y = 0.5;
      const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), skinMat);
      sHead.position.set(0, 1.15, 0);
      spec.add(sBody, sHead);
      group.add(spec);
    }
  }

  // Warm courtroom lighting overhead
  const courtLight = new THREE.PointLight(0xfff3c4, 35, 30, 2);
  courtLight.position.set(0, 8, -4);
  group.add(courtLight);

  return group;
}

