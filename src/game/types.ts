/**
 * Shared types and game state snapshots synchronized between
 * the Three.js simulation engine and the React HUD shell.
 */

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover' | 'trial';

export interface MinimapBlip {
  x: number;
  z: number;
  type: 'enemy' | 'police' | 'objective' | 'vehicle' | 'amazone';
}

export interface HudSnapshot {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  cash: number;
  ammo: number;
  maxAmmo: number;
  wantedLevel: number; // 0 to 3 stars
  wantedCooldown: number; // 0..1 progress before star decays
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  nearVehiclePrompt: string | null;
  missionIndex: number;
  totalMissions: number;
  missionTitle: string;
  missionObjective: string;
  missionProgress: number;
  missionTarget: number;
  districtName: string;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  blips: MinimapBlip[];
  muted: boolean;
  cameraPreset: 'chase' | 'interior' | 'cinematic';
  arrestProgress: number; // 0..1 progress while Police Républicaine officer is arresting player
  gameoverReason: 'dead' | 'arrested';
  anthemPlaying?: boolean;
}

export interface MobileInputState {
  moveX: number;
  moveY: number;
  firing: boolean;
  sprint: boolean;
}
