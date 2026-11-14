/**
 * Main Three.js game engine & 60fps simulation loop for Cotonou Syndicat.
 * Completely decoupled from React state: mounts into an isolated container ref,
 * emits throttled HUD snapshots to React, and handles Software-WebGL pacing.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import {
  createCar,
  createCharacterRig,
  createCourtroomScene,
  createZemidjan,
  type CharacterRig,
  type VehicleRig,
} from './models';
import { createCotonouTextures, type CotonouTextures } from './textures';
import type { GamePhase, HudSnapshot, MinimapBlip, MobileInputState } from './types';
import { buildCotonouWorld, type BoxCollider, type CotonouWorld } from './world';

// Pre-allocated math helpers outside the render loop (Zero-GC policy)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _mouseNdc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0);

interface VehicleEntity {
  id: number;
  name: string;
  rig: VehicleRig;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  maxSpeed: number;
  accel: number;
  turnRate: number;
  isPolice: boolean;
  policeState: 'patrol' | 'responding' | 'deployed';
  officersInside: number;
  deployPauseTimer: number;
  homeLoopIdx: number;
  trafficLoopIdx: number;
  trafficWpIdx: number;
  occupiedByPlayer: boolean;
  hitFlash: number;
}

interface ActorEntity {
  id: number;
  role: 'enemy' | 'police';
  rig: CharacterRig;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  windupTimer: number; // > 0 means telegraphing shot
  hitFlash: number;
  walkPhase: number;
  alive: boolean;
}

interface CivilianEntity {
  rig: CharacterRig;
  x: number;
  z: number;
  yaw: number;
  targetX: number;
  targetZ: number;
  waitTimer: number;
  walkPhase: number;
  panicTimer: number;
}

interface Projectile {
  active: boolean;
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  fromPlayer: boolean;
  life: number;
}

interface PickupItem {
  active: boolean;
  kind: 'cash' | 'health' | 'ammo' | 'bribe' | 'objective';
  mesh: THREE.Group;
  x: number;
  z: number;
  value: number;
  phase: number;
}

interface Particle {
  active: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface MissionDef {
  title: string;
  objective: string;
  kind: 'collect' | 'eliminate';
  target: number;
  points: [number, number][];
}

const MISSIONS: MissionDef[] = [
  {
    title: "L'Or de la Marina",
    objective: 'Récupérer les 3 mallettes de FCFA le long du Boulevard de la Marina',
    kind: 'collect',
    target: 3,
    points: [
      [-48, 25],
      [0, 44],
      [58, 25],
    ],
  },
  {
    title: 'Carrefour de Ganhi',
    objective: 'Éliminer les 4 guetteurs rivaux dans le Quartier Ganhi',
    kind: 'eliminate',
    target: 4,
    points: [
      [-36, -54],
      [-12, -78],
      [18, -78],
      [36, -50],
    ],
  },
  {
    title: 'Contrebande à Dantokpa',
    objective: 'Saisir les 3 caisses de contrebande près du secteur Dantokpa',
    kind: 'collect',
    target: 3,
    points: [
      [48, -36],
      [76, -54],
      [56, -78],
    ],
  },
  {
    title: 'Docks du Port Autonome',
    objective: 'Récupérer les 3 cargaisons illégales au Port Autonome de Cotonou',
    kind: 'collect',
    target: 3,
    points: [
      [-98, -42],
      [-114, -18],
      [-86, -64],
    ],
  },
  {
    title: 'Nuit à Haie Vive',
    objective: 'Nettoyer la zone commerciale de Haie Vive des rivaux',
    kind: 'eliminate',
    target: 4,
    points: [
      [96, -24],
      [112, -56],
      [84, -78],
      [104, -94],
    ],
  },
  {
    title: "Le Trône de l'Amazone",
    objective: "Neutraliser le commando rival devant la Statue de l'Amazone",
    kind: 'eliminate',
    target: 5,
    points: [
      [-18, 8],
      [18, 8],
      [-20, -14],
      [20, -14],
      [0, -24],
    ],
  },
];

export class CotonouGameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: CotonouTextures;
  private world!: CotonouWorld;
  private sound = new SoundEngine();

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  // Game state
  private phase: GamePhase = 'title';
  private freeRoam = false;
  private cameraPreset: 'chase' | 'interior' | 'cinematic' = 'chase';
  private titleOrbitAngle = 0.55;
  private gizmoOrbitAngle = 0;
  private gizmoZoomDist = 0;
  private courtroomGroup: THREE.Group | null = null;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private hudEmitAccum = 0;
  private pendingAnthemAutoplay = false;

  // Player state
  private playerRig!: CharacterRig;
  private playerX = 0;
  private playerZ = 16; // Starts right in front of Monument Amazone!
  private playerYaw = Math.PI; // Facing North toward the Amazone on spawn, or turns with input
  private playerWalkPhase = 0;
  private playerHealth = 100;
  private playerMaxHealth = 100;
  private playerCash = 25000;
  private playerAmmo = 48;
  private playerMaxAmmo = 60;
  private playerFireCooldown = 0;
  private playerHitFlash = 0;
  private wantedLevel = 0;
  private wantedDecayTimer = 0;
  private shootoutAlertTimer = 0;
  private lastShootoutX = 0;
  private lastShootoutZ = 0;
  private arrestProgress = 0;
  private gameoverReason: 'dead' | 'arrested' = 'dead';
  private activeVehicle: VehicleEntity | null = null;

  // Mission state
  private missionIndex = 0;
  private missionProgress = 0;
  private missionBeacon!: THREE.Group;

  // Entities & Pools
  private vehicles: VehicleEntity[] = [];
  private actors: ActorEntity[] = [];
  private civilians: CivilianEntity[] = [];
  private projectiles: Projectile[] = [];
  private pickups: PickupItem[] = [];
  private particles: Particle[] = [];
  private nextEntityId = 1;

  // Input state
  private heldKeys = new Set<string>();
  private justPressed = new Set<string>();
  private mouseDown = false;
  private mouseAimActive = false;
  private aimWorldPoint = new THREE.Vector3(0, 1, 0);
  public mobileInput: MobileInputState = { moveX: 0, moveY: 0, firing: false, sprint: false };

  // Camera smoothing state
  private camPos = new THREE.Vector3(0, 14, 34);
  private camLook = new THREE.Vector3(0, 4, -2);

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.initScene();
    this.bindEvents();
    this.resetWorldEntities();
    this.emitHud();
    this.startLoop();
    this.tryAutoplayAnthem();
  }

  private detectSoftwareGl(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    // Crisp Cotonou coastal late-afternoon sky matching the Monument Amazone photos
    const skyColor = 0xb9d5eb;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.0028);

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.14, 420);
    this.camera.position.copy(this.camPos);

    // Mandatory studio environment map for burnished bronze reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Tropical Cotonou Lighting Rig (<= 1 shadow caster)
    const hemi = new THREE.HemisphereLight(0xc2e3ff, 0x9b866b, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe6bd, 2.4);
    sun.position.set(58, 72, 68);
    sun.castShadow = !this.isSoftwareGl;
    const shadowRes = isMobile ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 260;
    const d = 105;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x8bc5ef, 0.75);
    rim.position.set(-60, 40, -70);
    this.scene.add(rim);

    // Warm monument accent light illuminating the bronze face & chestplate
    const monumentLight = new THREE.PointLight(0xffcb77, 45, 48, 1.4);
    monumentLight.position.set(5, 11, 12);
    this.scene.add(monumentLight);

    // Textures & World
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createCotonouTextures(maxAniso);
    this.world = buildCotonouWorld(this.textures);
    this.scene.add(this.world.group);

    // Player character (Koffi)
    this.playerRig = createCharacterRig('player', this.textures);
    this.scene.add(this.playerRig.group);

    // Objective golden beacon pillar
    this.missionBeacon = this.createObjectiveBeacon();
    this.scene.add(this.missionBeacon);

    // Pre-allocate object pools (projectiles & particles)
    this.initPools();

    // Pre-warm shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private createObjectiveBeacon(): THREE.Group {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 18, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    pillar.position.y = 9;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.45, 24),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    g.add(pillar, ring);
    g.visible = false;
    return g;
  }

  private initPools(): void {
    const bulletGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const playerBulletMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xff453a });

    for (let i = 0; i < 42; i++) {
      const mesh = new THREE.Mesh(bulletGeo, i < 24 ? playerBulletMat : enemyBulletMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectiles.push({
        active: false,
        mesh,
        x: 0,
        y: 1.2,
        z: 0,
        vx: 0,
        vz: 0,
        fromPlayer: true,
        life: 0,
      });
    }

    const partGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      const mesh = new THREE.Mesh(partGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        active: false,
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
      });
    }
  }

  private resetWorldEntities(): void {
    // Clear existing vehicles, actors, civilians, pickups
    for (const v of this.vehicles) this.scene.remove(v.rig.group);
    for (const a of this.actors) this.scene.remove(a.rig.group);
    for (const c of this.civilians) this.scene.remove(c.rig.group);
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.vehicles = [];
    this.actors = [];
    this.civilians = [];
    this.pickups = [];

    for (const b of this.projectiles) {
      b.active = false;
      b.mesh.visible = false;
    }

    // Reset player near the Esplanade de l'Amazone facing the Statue
    this.playerX = 0;
    this.playerZ = 14;
    this.playerYaw = Math.PI; // Looking North toward the Amazone statue on spawn
    this.playerHealth = this.playerMaxHealth;
    this.playerCash = 25000;
    this.playerAmmo = 48;
    this.wantedLevel = 0;
    this.wantedDecayTimer = 0;
    this.shootoutAlertTimer = 0;
    this.arrestProgress = 0;
    this.gameoverReason = 'dead';
    this.activeVehicle = null;
    this.cameraPreset = 'chase';
    this.playerRig.group.visible = true;
    this.playerRig.group.position.set(this.playerX, 0, this.playerZ);

    // Spawn a sleek car & Zémidjan right beside the Esplanade spawn so the player can drive immediately
    this.spawnVehicle('Berline Noire', false, false, 6.2, 17.5, -Math.PI / 2, -1, 0x161920);
    this.spawnVehicle('Zémidjan Express', true, false, -7.2, 17.5, Math.PI / 2, -1);
    this.spawnVehicle('Coupé Or', false, false, 24, 21, -Math.PI / 2, -1, 0xc27816);
    this.spawnVehicle('Zémidjan Moto', true, false, 22, 24, -Math.PI / 2, 0);
    this.spawnVehicle('Zémidjan Moto', true, false, -36, -6, 0, 1);
    this.spawnVehicle('Coupé Terracotta', false, false, -66, 22, Math.PI / 2, 0, 0xb45309);
    this.spawnVehicle('Berline Ivoire', false, false, 36, -42, 0, 1, 0xe5e0d5);

    // Police Républicaine du Bénin patrol units circulating across Cotonou avenues
    this.spawnVehicle('Police Républicaine', false, true, -48, 24, Math.PI / 2, 0, 0x142442);
    this.spawnVehicle('Police Républicaine', false, true, 48, 29, -Math.PI / 2, 1, 0x142442);
    this.spawnVehicle('4x4 Police Républicaine', false, true, -36, -34, 0, 1, 0x142442);

    // Spawn realistic strolling Cotonou pedestrians around the Esplanade & Marina
    const civStarts: [number, number][] = [
      [-14, 9],
      [14, 7],
      [-18, -6],
      [16, -9],
      [-7, -14],
      [9, -15],
      [-26, 20],
      [28, 20],
      [-42, 20],
      [44, 20],
    ];
    civStarts.forEach(([cx, cz], idx) => {
      this.spawnCivilian(cx, cz, idx);
    });

    // Ambient health & ammo pickups in Cotonou alleys
    this.spawnPickup('health', -30, -28, 35);
    this.spawnPickup('health', 36, 36, 35);
    this.spawnPickup('ammo', -56, 22, 24);
    this.spawnPickup('ammo', 56, -28, 24);
    this.spawnPickup('bribe', 0, 44, 1);

    this.missionIndex = 0;
    this.freeRoam = false;
    this.setupMission(0);
  }

  private spawnCivilian(x: number, z: number, variant: number): void {
    const rig = createCharacterRig('civilian', this.textures, variant);
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    const dest = this.pickCivilianWaypoint(x, z);
    this.civilians.push({
      rig,
      x,
      z,
      yaw: Math.atan2(dest.x - x, dest.z - z),
      targetX: dest.x,
      targetZ: dest.z,
      waitTimer: Math.random() * 1.5,
      walkPhase: Math.random() * Math.PI * 2,
      panicTimer: 0,
    });
  }

  private pickCivilianWaypoint(curX: number, curZ: number): { x: number; z: number } {
    const spots: [number, number][] = [
      [-15, 11],
      [15, 11],
      [-17, -11],
      [17, -11],
      [-10, 15],
      [10, 15],
      [-28, 19],
      [28, 19],
      [-48, 20],
      [48, 20],
    ];
    const choice = spots[Math.floor(Math.random() * spots.length)];
    if (Math.hypot(choice[0] - curX, choice[1] - curZ) < 3) {
      return { x: -choice[0], z: choice[1] };
    }
    return { x: choice[0], z: choice[1] };
  }

  private spawnVehicle(
    name: string,
    isMoto: boolean,
    isPolice: boolean,
    x: number,
    z: number,
    yaw: number,
    trafficLoopIdx: number,
    colorHex = 0x1e293b,
  ): VehicleEntity {
    const rig = isMoto ? createZemidjan(this.textures) : createCar(colorHex, isPolice, this.textures);
    rig.group.position.set(x, 0, z);
    rig.group.rotation.y = yaw;
    this.scene.add(rig.group);

    const entity: VehicleEntity = {
      id: this.nextEntityId++,
      name,
      rig,
      x,
      z,
      yaw,
      speed: 0,
      steerAngle: 0,
      maxSpeed: isMoto ? 26 : isPolice ? 25 : 23,
      accel: isMoto ? 22 : 16,
      turnRate: isMoto ? 2.9 : 2.1,
      isPolice,
      policeState: 'patrol',
      officersInside: isPolice ? 2 : 0,
      deployPauseTimer: 0,
      homeLoopIdx: trafficLoopIdx,
      trafficLoopIdx,
      trafficWpIdx: 0,
      occupiedByPlayer: false,
      hitFlash: 0,
    };
    this.vehicles.push(entity);
    return entity;
  }

  private spawnActor(role: 'enemy' | 'police', x: number, z: number): ActorEntity {
    const rig = createCharacterRig(role, this.textures);
    rig.group.position.set(x, 0, z);
    this.scene.add(rig.group);
    const maxHp = role === 'police' ? 75 : 65;
    const actor: ActorEntity = {
      id: this.nextEntityId++,
      role,
      rig,
      x,
      z,
      yaw: 0,
      hp: maxHp,
      maxHp,
      speed: role === 'police' ? 6.6 : 5.4,
      fireCooldown: 1.0 + Math.random() * 0.8,
      windupTimer: 0,
      hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      alive: true,
    };
    this.actors.push(actor);
    return actor;
  }

  private spawnPickup(
    kind: PickupItem['kind'],
    x: number,
    z: number,
    value: number,
  ): PickupItem {
    const g = new THREE.Group();
    const color =
      kind === 'cash'
        ? 0x22c55e
        : kind === 'health'
          ? 0xef4444
          : kind === 'ammo'
            ? 0x3b82f6
            : kind === 'bribe'
              ? 0xfacc15
              : 0xf59e0b;

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.5,
    });

    if (kind === 'objective') {
      const caseBox = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.72, 0.5), mat);
      caseBox.position.y = 0.85;
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.14, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.8 }),
      );
      handle.position.y = 1.28;
      g.add(caseBox, handle);
    } else if (kind === 'bribe') {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), mat);
      star.position.y = 0.9;
      g.add(star);
    } else {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mat);
      box.position.y = 0.75;
      g.add(box);
    }

    g.position.set(x, 0, z);
    this.scene.add(g);
    const item: PickupItem = {
      active: true,
      kind,
      mesh: g,
      x,
      z,
      value,
      phase: Math.random() * Math.PI * 2,
    };
    this.pickups.push(item);
    return item;
  }

  private setupMission(index: number): void {
    this.missionIndex = index;
    this.missionProgress = 0;

    // Remove previous mission objective pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (this.pickups[i].kind === 'objective') {
        this.scene.remove(this.pickups[i].mesh);
        this.pickups.splice(i, 1);
      }
    }

    const def = MISSIONS[index];
    if (!def) {
      this.freeRoam = true;
      this.missionBeacon.visible = false;
      return;
    }

    if (def.kind === 'collect') {
      for (const [px, pz] of def.points) {
        this.spawnPickup('objective', px, pz, 25000);
      }
      // Also guard Dantokpa/Marina with a couple rival gangsters
      this.spawnActor('enemy', def.points[0][0] + 6, def.points[0][1] - 4);
      this.spawnActor('enemy', def.points[1][0] - 6, def.points[1][1] + 4);
    } else {
      for (const [ex, ez] of def.points) {
        this.spawnActor('enemy', ex, ez);
      }
    }
  }

  public startGame(): void {
    this.pendingAnthemAutoplay = false;
    this.sound.unlock();
    this.sound.stopAnthem();
    if (this.phase === 'title' || this.phase === 'gameover' || this.phase === 'victory') {
      this.resetWorldEntities();
      this.phase = 'playing';
      // Snap chase camera cleanly behind Koffi looking toward the Monument Amazone
      this.camPos.set(this.playerX, 9.5, this.playerZ + 15);
      this.camLook.set(0, 4.5, -2);
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.emitHud();
    }
  }

  private tryAutoplayAnthem(): void {
    if (this.phase !== 'title' || this.disposed) return;
    void this.sound.playAnthem().then((started) => {
      if (!started && this.phase === 'title' && !this.disposed) {
        this.pendingAnthemAutoplay = true;
      }
    });
  }

  public continueFreeRoam(): void {
    this.sound.unlock();
    this.freeRoam = true;
    this.phase = 'playing';
    this.playerHealth = this.playerMaxHealth;
    this.playerAmmo = this.playerMaxAmmo;
    this.emitHud();
  }

  public orbitCamera(delta: number): void {
    this.gizmoOrbitAngle += delta;
  }

  public zoomCamera(delta: number): void {
    this.gizmoZoomDist = THREE.MathUtils.clamp(this.gizmoZoomDist + delta, -6, 9);
  }

  public payBailAndContinue(): void {
    if (this.playerCash < 15000) return;
    this.sound.unlock();
    this.playerCash -= 15000;
    this.wantedLevel = 0;
    this.wantedDecayTimer = 0;
    this.shootoutAlertTimer = 0;
    this.arrestProgress = 0;
    this.gameoverReason = 'dead';
    this.playerHealth = Math.max(50, this.playerHealth);

    // Remove courtroom scene & restore city world visibility
    if (this.courtroomGroup) {
      this.scene.remove(this.courtroomGroup);
      this.courtroomGroup = null;
    }
    this.world.group.visible = true;
    for (const v of this.vehicles) v.rig.group.visible = true;
    for (const a of this.actors) a.rig.group.visible = true;
    for (const c of this.civilians) c.rig.group.visible = true;
    this.playerRig.group.visible = true;

    // Clear active police officers from immediate area and return patrol cars to calm state
    for (let i = this.actors.length - 1; i >= 0; i--) {
      if (this.actors[i].role === 'police') {
        this.scene.remove(this.actors[i].rig.group);
        this.actors.splice(i, 1);
      }
    }
    for (const v of this.vehicles) {
      if (v.isPolice && !v.occupiedByPlayer) {
        v.policeState = 'patrol';
        v.officersInside = 2;
        v.trafficLoopIdx = v.homeLoopIdx;
      }
    }
    this.phase = 'playing';
    this.emitHud();
  }

  public restartGame(): void {
    this.sound.unlock();
    if (this.courtroomGroup) {
      this.scene.remove(this.courtroomGroup);
      this.courtroomGroup = null;
    }
    this.world.group.visible = true;
    for (const v of this.vehicles) v.rig.group.visible = true;
    for (const a of this.actors) a.rig.group.visible = true;
    for (const c of this.civilians) c.rig.group.visible = true;
    this.playerRig.group.visible = true;
    this.resetWorldEntities();
    this.phase = 'playing';
    this.camPos.set(this.playerX, 9.5, this.playerZ + 15);
    this.camLook.set(0, 4.5, -2);
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.heldKeys.clear();
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.emitHud();
    }
  }

  public toggleMute(): void {
    this.sound.unlock();
    const nextMuted = !this.sound.isMuted();
    this.sound.setMuted(nextMuted);
    if (!nextMuted && this.phase === 'title' && !this.sound.isAnthemPlaying()) {
      this.pendingAnthemAutoplay = false;
      void this.sound.playAnthem();
    }
    this.emitHud();
  }

  public toggleCameraPreset(): void {
    if (this.activeVehicle) {
      this.cameraPreset =
        this.cameraPreset === 'chase'
          ? 'interior'
          : this.cameraPreset === 'interior'
            ? 'cinematic'
            : 'chase';
    } else {
      this.cameraPreset = this.cameraPreset === 'chase' ? 'cinematic' : 'chase';
    }
    this.emitHud();
  }

  public toggleInteriorCamera(): void {
    if (!this.activeVehicle) return;
    this.cameraPreset = this.cameraPreset === 'interior' ? 'chase' : 'interior';
    this.emitHud();
  }

  public triggerVehicleAction(): void {
    this.justPressed.add('KeyF');
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('click', this.onWindowAnthemGesture, true);
    window.addEventListener('touchend', this.onWindowAnthemGesture, true);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onWindowAnthemGesture = (e: Event): void => {
    if (!this.pendingAnthemAutoplay || this.phase !== 'title' || this.disposed) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-start-game="true"]') || target?.closest('button[aria-label*="son"]')) {
      this.pendingAnthemAutoplay = false;
      return;
    }
    this.sound.unlock();
    void this.sound.playAnthem().then((started) => {
      if (started) {
        this.pendingAnthemAutoplay = false;
      }
    });
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    if (this.disposed) return;
    const isMobile =
      window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2),
    );
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    if (!this.heldKeys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.heldKeys.add(e.code);

    if (e.code === 'Escape') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        this.togglePause();
      }
    } else if ((e.code === 'Enter' || e.code === 'Space') && this.phase === 'title') {
      this.startGame();
    } else {
      if (this.pendingAnthemAutoplay && this.phase === 'title') {
        this.pendingAnthemAutoplay = false;
        void this.sound.playAnthem();
      }
      if (e.code === 'KeyM') {
        this.toggleMute();
      } else if (e.code === 'KeyC' && this.phase === 'playing') {
        this.toggleCameraPreset();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
    this.mouseDown = false;
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_mouseNdc, this.camera);
    if (_raycaster.ray.intersectPlane(_groundPlane, this.aimWorldPoint)) {
      this.mouseAimActive = true;
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0 || this.phase !== 'playing') return;
    this.sound.unlock();
    this.mouseDown = true;
    this.onPointerMove(e);
  };

  private onPointerUp = (): void => {
    this.mouseDown = false;
  };

  private startLoop(): void {
    this.clock.start();
    const tick = () => {
      if (this.disposed) return;
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  /**
   * Software-WebGL GPU fence pacing (per Three.js skill specification).
   */
  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private update(dt: number): void {
    // Animate Atlantic Ocean wave drift even on Title Screen
    this.textures.ocean.offset.x += dt * 0.03;
    this.textures.ocean.offset.y += dt * 0.015;

    if (this.phase === 'title') {
      // Heroic front/three-quarter sweep across the Esplanade de l'Amazone
      this.titleOrbitAngle += dt * 0.22;
      const swing = Math.sin(this.titleOrbitAngle) * 0.72; // Sweeps front-left to front-right
      const radius = 34;
      const tx = Math.sin(swing) * radius;
      const tz = -2 + Math.cos(swing) * radius;
      this.camera.position.set(tx, 6.2 + Math.sin(this.titleOrbitAngle * 0.6) * 1.4, tz);
      this.camera.lookAt(0, 9.2, -2);
      this.sound.updateLoops(dt, false, -1, false, 0);
      this.justPressed.clear();
      return;
    }

    if (this.phase === 'trial') {
      // Immersive 3D courtroom trial camera view & judge/audience animations
      this.camera.position.set(0, 3.8, 6.2);
      this.camera.lookAt(0, 2.2, -12);
      if (this.courtroomGroup) {
        const t = this.clock.elapsedTime;
        // Subtle judge nodding animation
        this.courtroomGroup.children.forEach((child, idx) => {
          if (idx >= 4 && idx <= 6) {
            child.rotation.x = Math.sin(t * 2 + idx) * 0.06;
          }
        });
      }
      this.sound.updateLoops(dt, false, -1, false, 0);
      this.justPressed.clear();
      return;
    }

    if (this.phase !== 'playing') {
      this.sound.updateLoops(dt, false, -1, false, 0);
      this.justPressed.clear();
      return;
    }

    // Hitstop freeze on heavy impacts
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      this.justPressed.clear();
      return;
    }

    // 1. Handle Enter / Exit Vehicle (F or E)
    if (this.justPressed.has('KeyF') || this.justPressed.has('KeyE')) {
      this.handleVehicleToggle();
    }
    this.justPressed.clear();

    // 2. Player On-Foot or Driving Simulation
    if (this.activeVehicle) {
      this.updateDriving(dt, this.activeVehicle);
    } else {
      this.updateOnFoot(dt);
    }

    // 3. Ambient & Police Vehicles
    this.updateVehicles(dt);

    // 4. Strolling Cotonou Civilians + Rival Gangsters & Police AI
    this.updateCivilians(dt);
    this.updateActors(dt);

    // 5. Projectiles & Collisions
    this.updateProjectiles(dt);

    // 6. Pickups & Mission Beacon
    this.updatePickups(dt);

    // 7. Particles, Shootout Alert & Wanted Star Decay
    this.updateParticles(dt);
    if (this.shootoutAlertTimer > 0) {
      this.shootoutAlertTimer = Math.max(0, this.shootoutAlertTimer - dt);
    }
    if (this.wantedLevel > 0) {
      this.wantedDecayTimer += dt;
      if (this.wantedDecayTimer >= 18) {
        this.wantedDecayTimer = 0;
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
      }
    }

    // 8. Audio engine + Police Républicaine siren loops when shootout is active
    const speedRatio = this.activeVehicle
      ? Math.min(1, Math.abs(this.activeVehicle.speed) / this.activeVehicle.maxSpeed)
      : -1;
    const sirenLevel = this.wantedLevel > 0 ? this.wantedLevel : this.shootoutAlertTimer > 0 ? 1 : 0;
    this.sound.updateLoops(dt, true, speedRatio, Boolean(this.activeVehicle?.rig.isMoto), sirenLevel);

    // 9. Smooth Third-Person / Interior Cockpit / Cinematic Camera
    this.updateCamera(dt);

    // 10. Emit throttled HUD snapshot (~15 Hz) so React stays lightweight
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.065) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private handleVehicleToggle(): void {
    if (this.activeVehicle) {
      // Exit vehicle to left side & return to 3rd-person chase cam if in interior view
      const v = this.activeVehicle;
      v.occupiedByPlayer = false;
      this.activeVehicle = null;
      if (this.cameraPreset === 'interior') {
        this.cameraPreset = 'chase';
      }
      const sideAngle = v.yaw + Math.PI / 2;
      const exitX = v.x + Math.sin(sideAngle) * 2.1;
      const exitZ = v.z + Math.cos(sideAngle) * 2.1;
      const resolved = this.resolveCollisions(exitX, exitZ, 0.55);
      this.playerX = resolved.x;
      this.playerZ = resolved.z;
      this.playerRig.group.visible = true;
      this.playerRig.group.position.set(this.playerX, 0, this.playerZ);
      this.sound.playVehicleToggle();
      this.emitHud();
      return;
    }

    // Find closest vehicle within 4.4 units
    let closest: VehicleEntity | null = null;
    let bestDist = 4.4;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
      if (d < bestDist) {
        bestDist = d;
        closest = v;
      }
    }

    if (closest) {
      this.activeVehicle = closest;
      closest.occupiedByPlayer = true;
      closest.trafficLoopIdx = -1; // Player takes full control
      this.playerRig.group.visible = false;
      this.sound.playVehicleToggle();
      // Hijacking a police 4x4 raises wanted level!
      if (closest.isPolice && this.wantedLevel < 2) {
        this.raiseWanted(2);
      }
      this.emitHud();
    }
  }

  private getMovementAxes(): { x: number; z: number; sprint: boolean } {
    let x = this.mobileInput.moveX;
    let z = this.mobileInput.moveY;
    // Support both AZERTY (ZQSD), QWERTY (WASD), and Arrow Keys
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('KeyQ') || this.heldKeys.has('ArrowLeft')) x -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) x += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('KeyZ') || this.heldKeys.has('ArrowUp')) z -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) z += 1;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    const sprint =
      this.mobileInput.sprint ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight');
    return { x, z, sprint };
  }

  private updateOnFoot(dt: number): void {
    const { x: mx, z: mz, sprint } = this.getMovementAxes();
    const speed = sprint ? 12.2 : 8.2;
    const moving = Math.hypot(mx, mz) > 0.08;

    if (moving) {
      const nx = this.playerX + mx * speed * dt;
      const nz = this.playerZ + mz * speed * dt;
      const res = this.resolveCollisions(nx, nz, 0.55);
      this.playerX = res.x;
      this.playerZ = res.z;
      this.playerWalkPhase += dt * (sprint ? 14 : 10);
    } else {
      this.playerWalkPhase = 0;
    }

    // Aiming: mouse world raycast if active, otherwise facing movement or nearest enemy
    const firing = this.mouseDown || this.heldKeys.has('Space') || this.mobileInput.firing;
    let targetYaw = this.playerYaw;
    if (this.mouseAimActive && this.mouseDown) {
      targetYaw = Math.atan2(this.aimWorldPoint.x - this.playerX, this.aimWorldPoint.z - this.playerZ);
    } else if (firing) {
      const nearest = this.findNearestActor(this.playerX, this.playerZ, 28);
      if (nearest) {
        targetYaw = Math.atan2(nearest.x - this.playerX, nearest.z - this.playerZ);
      } else if (moving) {
        targetYaw = Math.atan2(mx, mz);
      }
    } else if (moving) {
      targetYaw = Math.atan2(mx, mz);
    }

    this.playerYaw = this.dampAngle(this.playerYaw, targetYaw, 14, dt);
    this.playerRig.group.position.set(this.playerX, 0, this.playerZ);
    this.playerRig.group.rotation.y = this.playerYaw;

    // Walk animation
    const swing = moving ? Math.sin(this.playerWalkPhase) * 0.55 : 0;
    this.playerRig.leftLeg.rotation.x = swing;
    this.playerRig.rightLeg.rotation.x = -swing;
    this.playerRig.leftArm.rotation.x = -swing * 0.6;

    // Shooting
    this.playerFireCooldown = Math.max(0, this.playerFireCooldown - dt);
    if (firing && this.playerFireCooldown <= 0 && this.playerAmmo > 0) {
      this.firePlayerWeapon();
    }

    // Hit flash recovery
    if (this.playerHitFlash > 0) {
      this.playerHitFlash -= dt;
    }
  }

  private firePlayerWeapon(): void {
    this.playerFireCooldown = 0.19;
    this.playerAmmo = Math.max(0, this.playerAmmo - 1);
    this.sound.playShoot(false);
    this.cameraShake = Math.min(0.4, this.cameraShake + 0.09);

    // Subtle arm recoil
    this.playerRig.rightArm.rotation.x = -Math.PI / 1.85;

    this.playerRig.muzzlePoint.getWorldPosition(_vecA);
    const dirX = Math.sin(this.playerYaw);
    const dirZ = Math.cos(this.playerYaw);
    this.spawnProjectile(_vecA.x, 1.32, _vecA.z, dirX * 48, dirZ * 48, true);
    this.spawnBurst(_vecA.x, 1.32, _vecA.z, 0xfef08a, 4, 4);

    // Gunfire triggers Police Républicaine shootout dispatch!
    this.reportShootout(this.playerX, this.playerZ, true);
  }

  private reportShootout(x: number, z: number, byPlayer: boolean): void {
    this.lastShootoutX = x;
    this.lastShootoutZ = z;
    this.shootoutAlertTimer = 18;
    if (byPlayer) {
      this.raiseWanted(Math.max(1, this.wantedLevel));
    }
  }

  private updateDriving(dt: number, v: VehicleEntity): void {
    const { x: steerInput, z: throttleInput } = this.getMovementAxes();
    const handbrake = this.heldKeys.has('Space');
    // Forward is z < 0 (up key) -> throttle = -throttleInput
    const throttle = -throttleInput;
    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 5.5, dt);
    } else if (Math.abs(throttle) > 0.05) {
      v.speed += throttle * v.accel * dt;
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 2.8, dt);
    }
    v.speed = THREE.MathUtils.clamp(v.speed, -v.maxSpeed * 0.45, v.maxSpeed);

    // Steering scales with speed; visual front wheels & interior steering wheel rotate smoothly
    const speedFactor = THREE.MathUtils.clamp(Math.abs(v.speed) / 6, 0, 1);
    const dirSign = v.speed >= 0 ? 1 : -1;
    const turnBoost = handbrake ? 1.25 : 1.0;
    v.yaw -= steerInput * v.turnRate * turnBoost * speedFactor * dirSign * dt;
    v.steerAngle = THREE.MathUtils.damp(v.steerAngle, -steerInput * 0.42, 12, dt);

    // Lean Zémidjan motorcycle into turns!
    if (v.rig.isMoto) {
      const targetLean = -steerInput * 0.28 * speedFactor;
      v.rig.group.rotation.z = THREE.MathUtils.damp(v.rig.group.rotation.z, targetLean, 10, dt);
    }

    const vx = Math.sin(v.yaw) * v.speed * dt;
    const vz = Math.cos(v.yaw) * v.speed * dt;
    const radius = v.rig.isMoto ? 0.9 : 1.75;
    const res = this.resolveCollisions(v.x + vx, v.z + vz, radius);
    if (res.collided) {
      v.speed *= -0.25;
      this.cameraShake = Math.min(0.5, this.cameraShake + 0.16);
      this.sound.playHit(true);
    }
    v.x = res.x;
    v.z = res.z;

    // Sync player coordinates to vehicle
    this.playerX = v.x;
    this.playerZ = v.z;
    this.playerYaw = v.yaw;

    // Tire dust at speed or handbrake drift
    if ((Math.abs(v.speed) > 12 || (handbrake && Math.abs(v.speed) > 5)) && Math.random() < 0.4) {
      this.spawnBurst(v.x - Math.sin(v.yaw) * 1.4, 0.2, v.z - Math.cos(v.yaw) * 1.4, 0xc8b496, 1, 2);
    }

    // Ramming enemies or police at speed
    if (Math.abs(v.speed) > 8.5) {
      for (const a of this.actors) {
        if (!a.alive) continue;
        const dist = Math.hypot(a.x - v.x, a.z - v.z);
        if (dist < (v.rig.isMoto ? 1.5 : 2.1)) {
          this.damageActor(a, 75, true);
        }
      }
    }
  }

  private updateVehicles(dt: number): void {
    const t = this.clock.elapsedTime;
    const shootoutActive = this.wantedLevel > 0 || this.shootoutAlertTimer > 0;
    const alivePolice = this.actors.filter((a) => a.alive && a.role === 'police').length;

    for (const v of this.vehicles) {
      if (!v.occupiedByPlayer) {
        v.steerAngle = THREE.MathUtils.damp(v.steerAngle, 0, 8, dt);

        if (v.isPolice && shootoutActive) {
          // Police Républicaine vehicle turns on gyrophares & circulates to intercept shootout
          if (v.policeState === 'patrol') {
            v.policeState = 'responding';
            if (v.officersInside <= 0) v.officersInside = 2;
          }

          const targetX = this.wantedLevel > 0 ? this.playerX : this.lastShootoutX;
          const targetZ = this.wantedLevel > 0 ? this.playerZ : this.lastShootoutZ;
          const dx = targetX - v.x;
          const dz = targetZ - v.z;
          const dist = Math.hypot(dx, dz);

          if (v.policeState === 'responding') {
            if (dist > 52) {
              // Criminal successfully fled and escaped police pursuit distance!
              v.policeState = 'patrol';
              v.officersInside = 2;
              v.trafficLoopIdx = v.homeLoopIdx;
              if (this.shootoutAlertTimer > 0) this.shootoutAlertTimer = 0.5;
            } else if (dist > 10.5) {
              const targetYaw = Math.atan2(dx, dz);
              v.yaw = this.dampAngle(v.yaw, targetYaw, 2.8, dt);
              v.steerAngle = THREE.MathUtils.clamp((targetYaw - v.yaw) * 0.5, -0.35, 0.35);
              v.speed = THREE.MathUtils.damp(v.speed, 14.5 + this.wantedLevel * 2.2, 3.2, dt);
              const res = this.resolveCollisions(
                v.x + Math.sin(v.yaw) * v.speed * dt,
                v.z + Math.cos(v.yaw) * v.speed * dt,
                1.75,
              );
              v.x = res.x;
              v.z = res.z;
            } else {
              // Arrive at shootout perimeter -> brake & prepare to exit vehicle
              v.policeState = 'deployed';
              v.deployPauseTimer = 0.45;
              v.speed = THREE.MathUtils.damp(v.speed, 0, 6, dt);
            }
          } else if (v.policeState === 'deployed') {
            v.speed = THREE.MathUtils.damp(v.speed, 0, 7, dt);
            if (dist > 54) {
              // Fled while officers deployed
              v.policeState = 'patrol';
              v.officersInside = 2;
              v.trafficLoopIdx = v.homeLoopIdx;
            } else if (v.officersInside > 0) {
              v.deployPauseTimer -= dt;
              if (v.deployPauseTimer <= 0 && alivePolice < 6) {
                // Two Police Républicaine officers step out of left & right doors to arrest criminal
                for (const side of [-1, 1]) {
                  const doorAngle = v.yaw + (side * Math.PI) / 2;
                  const ox = v.x + Math.sin(doorAngle) * 1.95;
                  const oz = v.z + Math.cos(doorAngle) * 1.95;
                  const safe = this.resolveCollisions(ox, oz, 0.55);
                  const officer = this.spawnActor('police', safe.x, safe.z);
                  officer.yaw = Math.atan2(this.playerX - safe.x, this.playerZ - safe.z);
                }
                v.officersInside = 0;
                this.sound.playVehicleToggle();
              }
            } else if (dist > 36 && this.wantedLevel > 0 && alivePolice < 2) {
              // Criminal fled far away -> re-engage vehicle pursuit
              v.policeState = 'responding';
              v.officersInside = 2;
            }
          }
        } else {
          if (v.isPolice) {
            v.policeState = 'patrol';
            v.officersInside = 2;
            v.trafficLoopIdx = v.homeLoopIdx;
          }

          if (v.trafficLoopIdx >= 0) {
            // Ambient Cotonou traffic loop (including calm Police Républicaine patrols)
            const loop = this.world.roadLoops[v.trafficLoopIdx];
            const wp = loop[v.trafficWpIdx];
            const dx = wp.x - v.x;
            const dz = wp.z - v.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 4.5) {
              v.trafficWpIdx = (v.trafficWpIdx + 1) % loop.length;
            } else {
              const targetYaw = Math.atan2(dx, dz);
              v.yaw = this.dampAngle(v.yaw, targetYaw, 4.0, dt);
              v.speed = THREE.MathUtils.damp(v.speed, v.rig.isMoto ? 10.5 : 9.0, 3, dt);
              const res = this.resolveCollisions(
                v.x + Math.sin(v.yaw) * v.speed * dt,
                v.z + Math.cos(v.yaw) * v.speed * dt,
                v.rig.isMoto ? 0.9 : 1.7,
              );
              v.x = res.x;
              v.z = res.z;
            }
          } else {
            v.speed = THREE.MathUtils.damp(v.speed, 0, 4, dt);
          }
        }
      }

      // Apply transforms, spin wheels, steer front wheels & rotate cockpit steering wheel
      v.rig.group.position.set(v.x, 0, v.z);
      v.rig.group.rotation.y = v.yaw;
      for (const w of v.rig.wheels) {
        w.rotation.x += v.speed * dt * 1.4;
      }
      for (const pivot of v.rig.frontSteerPivots) {
        pivot.rotation.y = v.steerAngle;
      }
      if (v.rig.steeringWheel) {
        v.rig.steeringWheel.rotation.z = -v.steerAngle * 3.8;
      }

      // Flash Police Républicaine red & blue gyrophares during shootout response
      if (v.rig.sirenRed && v.rig.sirenBlue) {
        const activeSiren = !v.occupiedByPlayer && shootoutActive;
        const redOn = activeSiren && Math.sin(t * 16) > 0;
        const blueOn = activeSiren && !redOn;
        (v.rig.sirenRed.material as THREE.MeshStandardMaterial).emissiveIntensity = redOn ? 4.2 : 0.15;
        (v.rig.sirenBlue.material as THREE.MeshStandardMaterial).emissiveIntensity = blueOn ? 4.2 : 0.15;
        if (v.rig.sirenGlowRed && v.rig.sirenGlowBlue) {
          (v.rig.sirenGlowRed.material as THREE.MeshBasicMaterial).opacity = redOn ? 0.45 : 0;
          (v.rig.sirenGlowBlue.material as THREE.MeshBasicMaterial).opacity = blueOn ? 0.45 : 0;
        }
      }
    }
  }

  private updateCivilians(dt: number): void {
    const firingNow = this.mouseDown || (!this.activeVehicle && this.heldKeys.has('Space'));
    for (const c of this.civilians) {
      // Dodge speeding cars or flee nearby gunfire
      const distPlayer = Math.hypot(this.playerX - c.x, this.playerZ - c.z);
      const carThreat = this.activeVehicle && Math.abs(this.activeVehicle.speed) > 7 && distPlayer < 9;
      if ((firingNow && distPlayer < 22) || carThreat) {
        c.panicTimer = 3.0;
        const awayAngle = Math.atan2(c.x - this.playerX, c.z - this.playerZ);
        c.targetX = THREE.MathUtils.clamp(c.x + Math.sin(awayAngle) * 16, -85, 85);
        c.targetZ = THREE.MathUtils.clamp(c.z + Math.cos(awayAngle) * 16, -75, 42);
        c.waitTimer = 0;
      }
      if (c.panicTimer > 0) c.panicTimer -= dt;

      if (c.waitTimer > 0) {
        c.waitTimer -= dt;
        // Gently admire Monument Amazone when paused on the Esplanade
        const lookMonument = Math.atan2(0 - c.x, -2 - c.z);
        c.yaw = this.dampAngle(c.yaw, lookMonument, 3, dt);
        c.rig.leftLeg.rotation.x = THREE.MathUtils.damp(c.rig.leftLeg.rotation.x, 0, 10, dt);
        c.rig.rightLeg.rotation.x = THREE.MathUtils.damp(c.rig.rightLeg.rotation.x, 0, 10, dt);
        c.rig.leftArm.rotation.x = THREE.MathUtils.damp(c.rig.leftArm.rotation.x, 0, 10, dt);
        c.rig.rightArm.rotation.x = THREE.MathUtils.damp(c.rig.rightArm.rotation.x, 0, 10, dt);
      } else {
        const dx = c.targetX - c.x;
        const dz = c.targetZ - c.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.2) {
          const next = this.pickCivilianWaypoint(c.x, c.z);
          c.targetX = next.x;
          c.targetZ = next.z;
          c.waitTimer = 1.4 + Math.random() * 2.5;
        } else {
          const speed = c.panicTimer > 0 ? 5.6 : 2.3;
          c.yaw = this.dampAngle(c.yaw, Math.atan2(dx, dz), 6, dt);
          const res = this.resolveCollisions(
            c.x + Math.sin(c.yaw) * speed * dt,
            c.z + Math.cos(c.yaw) * speed * dt,
            0.45,
          );
          c.x = res.x;
          c.z = res.z;
          c.walkPhase += dt * (c.panicTimer > 0 ? 13 : 7);

          const swing = Math.sin(c.walkPhase) * 0.48;
          c.rig.leftLeg.rotation.x = swing;
          c.rig.rightLeg.rotation.x = -swing;
          c.rig.leftArm.rotation.x = -swing * 0.65;
          c.rig.rightArm.rotation.x = swing * 0.65;
        }
      }

      c.rig.group.position.set(c.x, 0, c.z);
      c.rig.group.rotation.y = c.yaw;
    }
  }

  private updateActors(dt: number): void {
    const shootoutActive = this.wantedLevel > 0 || this.shootoutAlertTimer > 0;
    let someoneArresting = false;

    for (const a of this.actors) {
      if (!a.alive) continue;

      const dx = this.playerX - a.x;
      const dz = this.playerZ - a.z;
      const dist = Math.hypot(dx, dz);
      const aggroRange = a.role === 'police' ? (shootoutActive ? 68 : 28) : 34;

      if (dist < aggroRange) {
        const targetYaw = Math.atan2(dx, dz);
        a.yaw = this.dampAngle(a.yaw, targetYaw, 7, dt);

        // Police Républicaine officers advance right up to the criminal to arrest them; enemies keep medium range
        const preferredDist = a.role === 'police' ? 1.85 : 13;
        if (dist > preferredDist) {
          const nx = a.x + Math.sin(a.yaw) * a.speed * dt;
          const nz = a.z + Math.cos(a.yaw) * a.speed * dt;
          const res = this.resolveCollisions(nx, nz, 0.55);
          a.x = res.x;
          a.z = res.z;
          a.walkPhase += dt * 9;
        }

        // Check close-range arrest when police officer corners criminal on foot or in slow car
        if (
          a.role === 'police' &&
          shootoutActive &&
          dist < 2.65 &&
          (!this.activeVehicle || Math.abs(this.activeVehicle.speed) < 4.5)
        ) {
          someoneArresting = true;
          a.windupTimer = 0;
          if (a.rig.telegraphMesh) {
            const mat = a.rig.telegraphMesh.material as THREE.MeshBasicMaterial;
            mat.opacity = 0.85;
            a.rig.telegraphMesh.scale.setScalar(1.35);
          }
        } else {
          // Fire windup telegraph before shooting (officers hold fire at very close arrest range)
          a.fireCooldown -= dt;
          const canShoot = a.role === 'enemy' || (shootoutActive && dist > 3.6);
          if (canShoot && a.fireCooldown <= 0 && a.windupTimer <= 0 && dist < 26) {
            a.windupTimer = 0.48;
          }
          if (a.windupTimer > 0) {
            a.windupTimer -= dt;
            if (a.rig.telegraphMesh) {
              const mat = a.rig.telegraphMesh.material as THREE.MeshBasicMaterial;
              mat.opacity = 0.75;
              const s = 0.7 + (1 - a.windupTimer / 0.48) * 0.5;
              a.rig.telegraphMesh.scale.setScalar(s);
            }
            if (a.windupTimer <= 0) {
              if (a.rig.telegraphMesh) {
                (a.rig.telegraphMesh.material as THREE.MeshBasicMaterial).opacity = 0;
              }
              a.fireCooldown = a.role === 'police' ? 1.15 : 1.45;
              a.rig.muzzlePoint.getWorldPosition(_vecA);
              const spread = (Math.random() - 0.5) * 0.14;
              const shotYaw = a.yaw + spread;
              this.spawnProjectile(_vecA.x, 1.3, _vecA.z, Math.sin(shotYaw) * 28, Math.cos(shotYaw) * 28, false);
              this.sound.playShoot(true);
              if (a.role === 'enemy') {
                this.reportShootout(a.x, a.z, false);
              }
            }
          }
        }
      } else if (a.rig.telegraphMesh) {
        (a.rig.telegraphMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      // Sync actor transform & leg swing
      a.rig.group.position.set(a.x, 0, a.z);
      a.rig.group.rotation.y = a.yaw;
      const swing = Math.sin(a.walkPhase) * 0.45;
      a.rig.leftLeg.rotation.x = swing;
      a.rig.rightLeg.rotation.x = -swing;

      if (a.hitFlash > 0) {
        a.hitFlash -= dt;
        if (a.hitFlash <= 0) {
          for (const part of a.rig.bodyParts) {
            (part.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
        }
      }
    }

    // Progress or decay criminal arrest timer
    if (someoneArresting) {
      this.arrestProgress = Math.min(1, this.arrestProgress + dt / 1.45);
      if (this.arrestProgress >= 1) {
        this.phase = 'trial';
        this.heldKeys.clear();
        this.sound.playVehicleToggle();

        // Hide open-world city & entities, show immersive 3D courtroom scene
        this.world.group.visible = false;
        for (const v of this.vehicles) v.rig.group.visible = false;
        for (const a of this.actors) a.rig.group.visible = false;
        for (const c of this.civilians) c.rig.group.visible = false;

        if (!this.courtroomGroup) {
          this.courtroomGroup = createCourtroomScene();
          this.scene.add(this.courtroomGroup);
        }
        this.courtroomGroup.visible = true;
        this.playerRig.group.visible = true;
        this.playerRig.group.position.set(0, 0, 0);
        this.playerRig.group.rotation.y = 0;

        this.emitHud();
      }
    } else {
      this.arrestProgress = Math.max(0, this.arrestProgress - dt * 1.4);
    }
  }

  private spawnProjectile(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number,
    fromPlayer: boolean,
  ): void {
    const startIdx = fromPlayer ? 0 : 24;
    const endIdx = fromPlayer ? 24 : this.projectiles.length;
    for (let i = startIdx; i < endIdx; i++) {
      const p = this.projectiles[i];
      if (!p.active) {
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = z;
        p.vx = vx;
        p.vz = vz;
        p.fromPlayer = fromPlayer;
        p.life = 1.25;
        p.mesh.position.set(x, y, z);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.life -= dt;
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.life <= 0 || this.pointInsideCollider(p.x, p.z)) {
        p.active = false;
        p.mesh.visible = false;
        this.spawnBurst(p.x, p.y, p.z, 0xfbbf24, 3, 5);
        continue;
      }

      if (p.fromPlayer) {
        for (const a of this.actors) {
          if (!a.alive) continue;
          if (Math.hypot(a.x - p.x, a.z - p.z) < 0.9) {
            p.active = false;
            p.mesh.visible = false;
            this.damageActor(a, 34, false);
            break;
          }
        }
      } else {
        const hitRadius = this.activeVehicle ? 1.55 : 0.75;
        if (Math.hypot(this.playerX - p.x, this.playerZ - p.z) < hitRadius) {
          p.active = false;
          p.mesh.visible = false;
          this.damagePlayer(this.activeVehicle ? 5 : 9);
        }
      }
    }
  }

  private damageActor(a: ActorEntity, dmg: number, rammed: boolean): void {
    a.hp -= dmg;
    a.hitFlash = 0.11;
    for (const part of a.rig.bodyParts) {
      (part.material as THREE.MeshStandardMaterial).emissive.setHex(0x882211);
    }
    this.sound.playHit(rammed);
    this.spawnBurst(a.x, 1.2, a.z, 0xf87171, 6, 6);

    if (a.hp <= 0) {
      a.alive = false;
      this.scene.remove(a.rig.group);
      this.hitstopTimer = 0.04;
      this.cameraShake = Math.min(0.45, this.cameraShake + 0.2);
      this.spawnBurst(a.x, 1.0, a.z, 0xfacc15, 10, 8);
      this.spawnPickup('cash', a.x, a.z, 10000);

      // Wanted escalation on crimes
      if (a.role === 'police') {
        this.raiseWanted(3);
      } else {
        this.raiseWanted(Math.min(3, this.wantedLevel + 1));
      }

      // Check eliminate mission objective
      const def = MISSIONS[this.missionIndex];
      if (!this.freeRoam && def && def.kind === 'eliminate' && a.role === 'enemy') {
        this.missionProgress += 1;
        if (this.missionProgress >= def.target) {
          this.advanceMission();
        }
      } else if (this.freeRoam && a.role === 'enemy') {
        // Endless wave respawn in free roam
        const angle = Math.random() * Math.PI * 2;
        const rx = THREE.MathUtils.clamp(Math.cos(angle) * 45, -80, 80);
        const rz = THREE.MathUtils.clamp(Math.sin(angle) * 45 - 20, -80, 30);
        const safe = this.resolveCollisions(rx, rz, 0.7);
        this.spawnActor('enemy', safe.x, safe.z);
      }
    }
  }

  private damagePlayer(dmg: number): void {
    this.playerHealth = Math.max(0, this.playerHealth - dmg);
    this.playerHitFlash = 0.14;
    this.cameraShake = Math.min(0.5, this.cameraShake + 0.18);
    this.sound.playHit(false);
    if (this.playerHealth <= 0) {
      this.gameoverReason = 'dead';
      this.phase = 'gameover';
      this.heldKeys.clear();
      this.emitHud();
    }
  }

  private raiseWanted(level: number): void {
    this.wantedLevel = Math.max(this.wantedLevel, Math.min(3, level));
    this.wantedDecayTimer = 0;
  }

  private updatePickups(dt: number): void {
    let nearestObj: PickupItem | null = null;
    let bestObjDist = Infinity;

    for (const p of this.pickups) {
      if (!p.active) continue;
      p.phase += dt * 3;
      p.mesh.rotation.y += dt * 1.8;
      p.mesh.position.y = Math.sin(p.phase) * 0.16;

      if (p.kind === 'objective') {
        const d = Math.hypot(p.x - this.playerX, p.z - this.playerZ);
        if (d < bestObjDist) {
          bestObjDist = d;
          nearestObj = p;
        }
      }

      const grabRadius = this.activeVehicle ? 2.5 : 1.75;
      if (Math.hypot(p.x - this.playerX, p.z - this.playerZ) < grabRadius) {
        p.active = false;
        this.scene.remove(p.mesh);

        if (p.kind === 'cash') {
          this.playerCash += p.value;
          this.sound.playPickup('cash');
        } else if (p.kind === 'health') {
          this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + p.value);
          this.sound.playPickup('health');
        } else if (p.kind === 'ammo') {
          this.playerAmmo = Math.min(this.playerMaxAmmo, this.playerAmmo + p.value);
          this.sound.playPickup('cash');
        } else if (p.kind === 'bribe') {
          this.wantedLevel = 0;
          this.wantedDecayTimer = 0;
          this.sound.playPickup('health');
        } else if (p.kind === 'objective') {
          this.playerCash += p.value;
          this.sound.playPickup('cash');
          this.missionProgress += 1;
          const def = MISSIONS[this.missionIndex];
          if (!this.freeRoam && def && this.missionProgress >= def.target) {
            this.advanceMission();
          }
        }
      }
    }

    // Position the tall golden beacon over the next objective (pickup or enemy)
    if (!this.freeRoam) {
      if (nearestObj) {
        this.missionBeacon.visible = true;
        this.missionBeacon.position.set(nearestObj.x, 0, nearestObj.z);
      } else {
        const targetEnemy = this.actors.find((a) => a.alive && a.role === 'enemy');
        if (targetEnemy) {
          this.missionBeacon.visible = true;
          this.missionBeacon.position.set(targetEnemy.x, 0, targetEnemy.z);
        } else {
          this.missionBeacon.visible = false;
        }
      }
    }
  }

  private advanceMission(): void {
    this.sound.playPickup('mission');
    this.playerCash += 50000;
    this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 35);
    this.playerAmmo = this.playerMaxAmmo;

    if (this.missionIndex + 1 < MISSIONS.length) {
      this.setupMission(this.missionIndex + 1);
    } else {
      this.phase = 'victory';
      this.heldKeys.clear();
      this.missionBeacon.visible = false;
      this.emitHud();
    }
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: number, count: number, speed: number): void {
    let spawned = 0;
    for (const part of this.particles) {
      if (!part.active) {
        part.active = true;
        part.life = 0.36;
        part.maxLife = 0.36;
        part.mesh.position.set(x, y, z);
        part.mesh.scale.setScalar(1);
        (part.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        part.mesh.visible = true;
        part.vx = (Math.random() - 0.5) * speed * 2;
        part.vy = Math.random() * speed + 1.5;
        part.vz = (Math.random() - 0.5) * speed * 2;
        spawned++;
        if (spawned >= count) break;
      }
    }
  }

  private updateParticles(dt: number): void {
    for (const part of this.particles) {
      if (!part.active) continue;
      part.life -= dt;
      if (part.life <= 0) {
        part.active = false;
        part.mesh.visible = false;
        continue;
      }
      part.vy -= 14 * dt;
      part.mesh.position.x += part.vx * dt;
      part.mesh.position.y = Math.max(0.05, part.mesh.position.y + part.vy * dt);
      part.mesh.position.z += part.vz * dt;
      part.mesh.scale.setScalar(part.life / part.maxLife);
    }
  }

  private updateCamera(dt: number): void {
    // Apply decaying trauma camera shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.cameraShake > 0.005) {
      shakeX = (Math.random() - 0.5) * this.cameraShake * 1.1;
      shakeY = (Math.random() - 0.5) * this.cameraShake * 1.1;
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 12, dt);
    } else {
      this.cameraShake = 0;
    }

    // First-person cockpit driving view inside the car (or on Zémidjan)
    if (
      this.cameraPreset === 'interior' &&
      this.activeVehicle &&
      this.activeVehicle.rig.cockpitAnchor &&
      this.activeVehicle.rig.cockpitLookTarget
    ) {
      this.activeVehicle.rig.group.updateMatrixWorld(true);
      this.activeVehicle.rig.cockpitAnchor.getWorldPosition(_vecA);
      this.activeVehicle.rig.cockpitLookTarget.getWorldPosition(_vecB);

      // Subtle suspension bounce & look-into-turn offset
      const speedNorm = Math.min(1, Math.abs(this.activeVehicle.speed) / this.activeVehicle.maxSpeed);
      const bob = Math.sin(this.clock.elapsedTime * 16) * 0.012 * speedNorm;
      const steerOffset = this.activeVehicle.steerAngle * 2.2;
      _vecC.set(Math.cos(this.activeVehicle.yaw), 0, -Math.sin(this.activeVehicle.yaw));
      _vecB.addScaledVector(_vecC, steerOffset);

      this.camPos.copy(_vecA);
      this.camLook.copy(_vecB);
      this.camera.position.set(_vecA.x + shakeX * 0.35, _vecA.y + bob + shakeY * 0.35, _vecA.z);
      this.camera.lookAt(_vecB);

      const targetFov = 60 + speedNorm * 8;
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    // Third-person Chase cam vs Cinematic Monument overview
    let desiredX: number;
    let desiredY: number;
    let desiredZ: number;
    let lookX = this.playerX;
    let lookY = 1.8;
    let lookZ = this.playerZ;

    if (this.cameraPreset === 'cinematic') {
      desiredX = this.playerX + 18;
      desiredY = 18;
      desiredZ = this.playerZ + 22;
      // Blend look slightly toward Monument Amazone if nearby
      if (Math.hypot(this.playerX, this.playerZ + 2) < 42) {
        lookX = THREE.MathUtils.lerp(this.playerX, 0, 0.32);
        lookY = 4.5;
        lookZ = THREE.MathUtils.lerp(this.playerZ, -2, 0.32);
      }
    } else if (this.activeVehicle) {
      const backDist = (this.activeVehicle.rig.isMoto ? 9.5 : 12.0) + this.gizmoZoomDist;
      const adjustedYaw = this.playerYaw + this.gizmoOrbitAngle;
      desiredX = this.playerX - Math.sin(adjustedYaw) * backDist;
      desiredY = (this.activeVehicle.rig.isMoto ? 5.6 : 6.8) - this.gizmoZoomDist * 0.3;
      desiredZ = this.playerZ - Math.cos(adjustedYaw) * backDist;
      lookX = this.playerX + Math.sin(this.playerYaw) * 4;
      lookZ = this.playerZ + Math.cos(this.playerYaw) * 4;
    } else {
      const backDist = 14.5 + this.gizmoZoomDist;
      const adjustedYaw = this.gizmoOrbitAngle;
      desiredX = this.playerX + Math.sin(adjustedYaw) * backDist;
      desiredY = 13.5 - this.gizmoZoomDist * 0.3;
      desiredZ = this.playerZ + Math.cos(adjustedYaw) * backDist;
    }

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, desiredX, 6.5, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, desiredY, 6.5, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, desiredZ, 6.5, dt);

    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, lookX, 9, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, lookY, 9, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, lookZ, 9, dt);

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camera.lookAt(this.camLook);

    // Dynamic FOV boost when speeding in a vehicle
    const speedRatio = this.activeVehicle
      ? Math.min(1, Math.abs(this.activeVehicle.speed) / this.activeVehicle.maxSpeed)
      : 0;
    const targetFov = 54 + speedRatio * 10;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private resolveCollisions(x: number, z: number, radius: number): { x: number; z: number; collided: boolean } {
    let rx = THREE.MathUtils.clamp(x, -98, 98);
    let rz = THREE.MathUtils.clamp(z, -88, 57); // South bound stops at Atlantic surf!
    let collided = rx !== x || rz !== z;

    for (const c of this.world.colliders) {
      const closestX = THREE.MathUtils.clamp(rx, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, c.minZ, c.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        collided = true;
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          rz = c.maxZ + radius;
        }
      }
    }
    return { x: rx, z: rz, collided };
  }

  private pointInsideCollider(x: number, z: number): boolean {
    if (x < -102 || x > 102 || z < -94 || z > 62) return true;
    for (const c of this.world.colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }

  private findNearestActor(x: number, z: number, maxRange: number): ActorEntity | null {
    let best: ActorEntity | null = null;
    let bestD = maxRange;
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  private dampAngle(current: number, target: number, lambda: number, dt: number): number {
    let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * (1 - Math.exp(-lambda * dt));
  }

  private emitHud(): void {
    let nearVehiclePrompt: string | null = null;
    if (!this.activeVehicle) {
      let bestD = 4.4;
      for (const v of this.vehicles) {
        const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
        if (d < bestD) {
          bestD = d;
          nearVehiclePrompt = v.name;
        }
      }
    }

    const blips: MinimapBlip[] = [{ x: 0, z: -2, type: 'amazone' }];
    for (const a of this.actors) {
      if (!a.alive) continue;
      blips.push({ x: a.x, z: a.z, type: a.role });
    }
    for (const p of this.pickups) {
      if (p.active && p.kind === 'objective') {
        blips.push({ x: p.x, z: p.z, type: 'objective' });
      }
    }
    for (const v of this.vehicles) {
      if (!v.occupiedByPlayer) {
        if (v.isPolice) {
          blips.push({ x: v.x, z: v.z, type: 'police' });
        } else {
          blips.push({ x: v.x, z: v.z, type: 'vehicle' });
        }
      }
    }

    const def = MISSIONS[this.missionIndex];
    const missionTitle = this.freeRoam ? 'Contrôle Total · Mode Libre' : def.title;
    const missionObjective = this.freeRoam
      ? 'Explorez Cotonou autour de la Statue de l’Amazone'
      : def.objective;

    this.onHudUpdate({
      phase: this.phase,
      health: Math.round(this.playerHealth),
      maxHealth: this.playerMaxHealth,
      cash: this.playerCash,
      ammo: this.playerAmmo,
      maxAmmo: this.playerMaxAmmo,
      wantedLevel: this.wantedLevel,
      wantedCooldown: this.wantedLevel > 0 ? this.wantedDecayTimer / 18 : 0,
      inVehicle: Boolean(this.activeVehicle),
      vehicleName: this.activeVehicle?.name ?? '',
      speedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.8) : 0,
      nearVehiclePrompt,
      missionIndex: this.missionIndex,
      totalMissions: MISSIONS.length,
      missionTitle,
      missionObjective,
      missionProgress: this.missionProgress,
      missionTarget: def ? def.target : 0,
      districtName: this.world.getDistrictAt(this.playerX, this.playerZ),
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerYaw: this.playerYaw,
      blips,
      muted: this.sound.isMuted(),
      cameraPreset: this.cameraPreset,
      arrestProgress: this.arrestProgress,
      gameoverReason: this.gameoverReason,
      anthemPlaying: this.sound.isAnthemPlaying(),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('click', this.onWindowAnthemGesture, true);
    window.removeEventListener('touchend', this.onWindowAnthemGesture, true);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('webglcontextlost', this.onContextLost);

    this.sound.dispose();
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
    this.renderer.dispose();
    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
