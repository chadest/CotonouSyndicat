/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Root Game Shell for Cotonou Syndicat.
 * Isolates the Three.js WebGL mount container from sibling React HUD overlays
 * so HUD updates never tear down or reset the 3D scene.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { TitleScreen } from './components/TitleScreen';
import { CotonouGameEngine } from './game/engine';
import type { HudSnapshot, MobileInputState } from './game/types';

const GameHud = lazy(() => import('./components/GameHud').then((m) => ({ default: m.GameHud })));
const GameModal = lazy(() =>
  import('./components/GameModal').then((m) => ({ default: m.GameModal })),
);

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

function isMobilePortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const isTouchDevice =
    window.matchMedia('(pointer: coarse)').matches ||
    (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
  return isTouchDevice && window.innerHeight > window.innerWidth;
}

async function requestMobileLandscape(): Promise<void> {
  if (typeof window === 'undefined') return;
  const isTouchDevice =
    window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen can be declined by some mobile browsers (e.g. iOS Safari)
  }

  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    await orientation?.lock?.('landscape');
  } catch {
    // screen.orientation.lock is unsupported on iOS Safari outside standalone mode
  }
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CotonouGameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [mobilePortrait, setMobilePortrait] = useState<boolean>(() => isMobilePortraitViewport());

  useEffect(() => {
    const currentUrl = window.location.origin + window.location.pathname;
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = currentUrl;
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.content = currentUrl;

    const handleOrientationCheck = () => {
      setMobilePortrait(isMobilePortraitViewport());
    };
    window.addEventListener('resize', handleOrientationCheck);
    window.addEventListener('orientationchange', handleOrientationCheck);

    const container = mountRef.current;
    if (!container) {
      return () => {
        window.removeEventListener('resize', handleOrientationCheck);
        window.removeEventListener('orientationchange', handleOrientationCheck);
      };
    }

    const engine = new CotonouGameEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      window.removeEventListener('resize', handleOrientationCheck);
      window.removeEventListener('orientationchange', handleOrientationCheck);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    void requestMobileLandscape();
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
        />
      )}

      <Suspense fallback={null}>
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
      </Suspense>

      {mobilePortrait && (
        <div className="fixed inset-0 z-50 bg-[#0e1116]/95 flex flex-col items-center justify-center gap-5 p-6 text-center">
          <div className="w-16 h-16 rounded-xl bg-[#161b24] border border-[#eab308]/40 flex items-center justify-center text-[#eab308]">
            <RotateCw className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold tracking-wide text-[#f5f2eb]">
            Mode paysage requis
          </h2>
          <button
            type="button"
            onClick={() => void requestMobileLandscape()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-sm tracking-wide hover:bg-[#facc15] transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
            <span>Passer en paysage</span>
          </button>
        </div>
      )}
    </main>
  );
}
