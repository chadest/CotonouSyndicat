/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Root Game Shell for Cotonou Syndicat.
 * Isolates the Three.js WebGL mount container from sibling React HUD overlays
 * so HUD updates never tear down or reset the 3D scene.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameModal } from './components/GameModal';
import { TitleScreen } from './components/TitleScreen';
import { CotonouGameEngine } from './game/engine';
import type { HudSnapshot, MobileInputState } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  health: 100,
  maxHealth: 100,
  cash: 25000,
  ammo: 48,
  maxAmmo: 60,
  wantedLevel: 0,
  wantedCooldown: 0,
  inVehicle: false,
  vehicleName: '',
  speedKmh: 0,
  nearVehiclePrompt: null,
  missionIndex: 0,
  totalMissions: 4,
  missionTitle: "L'Or de la Marina",
  missionObjective: 'Récupérer les 3 mallettes de FCFA le long du Boulevard de la Marina',
  missionProgress: 0,
  missionTarget: 3,
  districtName: "Esplanade de l'Amazone",
  playerX: 0,
  playerZ: 14,
  playerYaw: Math.PI,
  blips: [],
  muted: false,
  cameraPreset: 'chase',
  arrestProgress: 0,
  gameoverReason: 'dead',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CotonouGameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new CotonouGameEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleAnthem = useCallback(() => {
    engineRef.current?.toggleAnthem();
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleToggleCamera = useCallback(() => {
    engineRef.current?.toggleCameraPreset();
  }, []);

  const handleToggleInterior = useCallback(() => {
    engineRef.current?.toggleInteriorCamera();
  }, []);

  const handleVehicleToggle = useCallback(() => {
    engineRef.current?.triggerVehicleAction();
  }, []);

  const handleContinueFreeRoam = useCallback(() => {
    engineRef.current?.continueFreeRoam();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartGame();
  }, []);

  const handlePayBail = useCallback(() => {
    engineRef.current?.payBailAndContinue();
  }, []);

  const handleMobileInput = useCallback((patch: Partial<MobileInputState>) => {
    if (!engineRef.current) return;
    Object.assign(engineRef.current.mobileInput, patch);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0e1116]">
      {/* Isolated Three.js WebGL Viewport Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {hud.phase === 'title' && (
        <TitleScreen
          onStart={handleStart}
          muted={hud.muted}
          onToggleMute={handleToggleMute}
          onToggleAnthem={handleToggleAnthem}
          anthemPlaying={Boolean(hud.anthemPlaying)}
        />
      )}

      {hud.phase === 'playing' && (
        <GameHud
          hud={hud}
          onPause={handleTogglePause}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleInterior={handleToggleInterior}
          onVehicleToggle={handleVehicleToggle}
          onMobileInput={handleMobileInput}
        />
      )}

      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'gameover') && (
        <GameModal
          phase={hud.phase}
          cash={hud.cash}
          gameoverReason={hud.gameoverReason}
          onResume={handleTogglePause}
          onContinueFreeRoam={handleContinueFreeRoam}
          onPayBail={handlePayBail}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}
