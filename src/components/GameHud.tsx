/**
 * Minimal, low-occlusion perimeter HUD during active Cotonou gameplay.
 * Zero backdrop-filter, zero gradients, tabular numerals, and responsive mobile controls.
 */
import React, { useRef } from 'react';
import {
  Camera,
  Car,
  Crosshair,
  Eye,
  Heart,
  Pause,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { HudSnapshot, MobileInputState } from '../game/types';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: HudSnapshot;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleInterior: () => void;
  onVehicleToggle: () => void;
  onMobileInput: (patch: Partial<MobileInputState>) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onPause,
  onToggleMute,
  onToggleCamera,
  onToggleInterior,
  onVehicleToggle,
  onMobileInput,
}) => {
  const padOrigin = useRef<{ x: number; y: number } | null>(null);
  const healthPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));

  const handlePadStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    padOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updatePad(e.clientX, e.clientY);
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!padOrigin.current) return;
    updatePad(e.clientX, e.clientY);
  };

  const handlePadEnd = () => {
    padOrigin.current = null;
    onMobileInput({ moveX: 0, moveY: 0 });
  };

  const updatePad = (cx: number, cy: number) => {
    if (!padOrigin.current) return;
    const dx = cx - padOrigin.current.x;
    const dy = cy - padOrigin.current.y;
    const maxR = 42;
    const dist = Math.hypot(dx, dy);
    const clamped = dist > maxR ? maxR / dist : 1;
    onMobileInput({
      moveX: (dx * clamped) / maxR,
      moveY: (dy * clamped) / maxR,
    });
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Top Perimeter Row */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Health, Ammo, Cash & Wanted Stars */}
        <div className="bg-[#12161d]/90 border border-white/15 rounded-lg px-4 py-3 flex flex-col gap-2 min-w-[205px]">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono-tabular text-lg font-bold text-[#eab308]">
              {hud.cash.toLocaleString('fr-FR')} FCFA
            </span>
            <div className="flex items-center gap-1" aria-label={`Recherche ${hud.wantedLevel} étoiles`}>
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= hud.wantedLevel
                      ? 'text-[#ef4444] fill-[#ef4444]'
                      : 'text-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Health bar + tabular integer */}
          <div className="flex items-center gap-2.5">
            <Heart className="w-4 h-4 text-[#ef4444] shrink-0" />
            <div className="flex-1 h-2 bg-white/10 rounded-sm overflow-hidden">
              <div
                className="h-full bg-[#ef4444] transition-transform duration-150 origin-left"
                style={{ transform: `scaleX(${healthPct / 100})` }}
              />
            </div>
            <span className="font-mono-tabular text-xs text-[#f5f2eb] w-8 text-right">
              {hud.health}
            </span>
          </div>

          {/* Ammo readout */}
          <div className="flex items-center justify-between text-xs text-[#c8c2b6]">
            <span>{hud.districtName}</span>
            <span className="font-mono-tabular text-[#f5f2eb]">
              {hud.ammo}/{hud.maxAmmo}
            </span>
          </div>
        </div>

        {/* Top-Center: Compact 1-line Mission Objective */}
        <div className="hidden lg:flex flex-col items-center bg-[#12161d]/90 border border-white/15 rounded-lg px-5 py-2.5 max-w-md text-center">
          <div className="flex items-center gap-2 text-xs text-[#eab308] font-display font-bold tracking-wider">
            <span>{hud.missionTitle}</span>
            {hud.missionTarget > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {hud.missionProgress}/{hud.missionTarget}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-[#e5e0d5] mt-0.5 truncate max-w-full">
            {hud.missionObjective}
          </p>
        </div>

        {/* Top-Right: Radar Minimap & Action Icon Buttons */}
        <div className="flex items-start gap-2.5 pointer-events-auto">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause"
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#12161d]/90 border border-white/15 text-[#f5f2eb] hover:bg-[#1e2430] transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleCamera}
              aria-label="Changer de caméra"
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#12161d]/90 border border-white/15 text-[#f5f2eb] hover:bg-[#1e2430] transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={hud.muted ? 'Activer le son' : 'Couper le son'}
              className="h-10 w-10 flex items-center justify-center rounded-lg bg-[#12161d]/90 border border-white/15 text-[#f5f2eb] hover:bg-[#1e2430] transition-colors cursor-pointer"
            >
              {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
          <div className="hidden sm:block">
            <Minimap playerX={hud.playerX} playerZ={hud.playerZ} blips={hud.blips} />
          </div>
        </div>
      </div>

      {/* Bottom Perimeter Row: Context Prompts + Speedometer + Mobile Touch Controls */}
      <div className="flex items-end justify-between gap-4">
        {/* Mobile Virtual Stick (visible below md breakpoint) */}
        <div
          onPointerDown={handlePadStart}
          onPointerMove={handlePadMove}
          onPointerUp={handlePadEnd}
          onPointerCancel={handlePadEnd}
          className="md:hidden pointer-events-auto w-28 h-28 rounded-full bg-[#12161d]/80 border border-white/20 flex items-center justify-center touch-none"
          aria-label="Joystick de déplacement"
        >
          <div className="w-11 h-11 rounded-full bg-[#eab308]/90 border border-white/30" />
        </div>

        {/* Center Contextual Prompt or Vehicle Speedometer */}
        <div className="flex-1 flex flex-col items-center gap-2 pb-1">
          {hud.arrestProgress > 0.02 && (
            <div className="bg-[#12161d]/95 border border-[#ef4444]/70 rounded-lg px-4 py-2 w-60 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-display font-bold text-[#f5f2eb]">
                <span>Police Républicaine</span>
                <span className="text-[#ef4444]">Interpellation</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[#ef4444] origin-left"
                  style={{ transform: `scaleX(${Math.min(1, hud.arrestProgress)})` }}
                />
              </div>
            </div>
          )}

          {hud.inVehicle ? (
            <div className="pointer-events-auto bg-[#12161d]/90 border border-white/15 rounded-lg px-4 py-2 flex flex-wrap items-center justify-center gap-3 md:gap-4">
              <span className="text-xs font-medium text-[#d6d0c4]">{hud.vehicleName}</span>
              <span className="font-mono-tabular text-base font-bold text-[#eab308]">
                {hud.speedKmh} km/h
              </span>
              <button
                type="button"
                onClick={onToggleInterior}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
                  hud.cameraPreset === 'interior'
                    ? 'bg-[#eab308] text-[#11151c] border-[#eab308]'
                    : 'bg-[#1a202c] text-[#f5f2eb] border-white/15 hover:bg-[#232b3a]'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{hud.cameraPreset === 'interior' ? 'Vue Extérieure' : 'Vue Intérieure'}</span>
              </button>
              <span className="text-xs text-[#9ca3af] hidden md:inline">F / E Sortir</span>
            </div>
          ) : hud.nearVehiclePrompt ? (
            <button
              type="button"
              onClick={onVehicleToggle}
              className="pointer-events-auto bg-[#12161d]/95 border border-[#eab308]/60 rounded-lg px-4 py-2 flex items-center gap-2 text-xs font-medium text-[#f5f2eb] cursor-pointer"
            >
              <Car className="w-4 h-4 text-[#eab308]" />
              <span>F / E · Monter ({hud.nearVehiclePrompt})</span>
            </button>
          ) : null}
        </div>

        {/* Mobile Fire & Vehicle Action Buttons */}
        <div className="md:hidden pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onVehicleToggle}
            aria-label="Véhicule"
            className="w-12 h-12 rounded-full bg-[#12161d]/90 border border-white/20 flex items-center justify-center text-[#f5f2eb]"
          >
            <Car className="w-5 h-5" />
          </button>
          <button
            type="button"
            onPointerDown={() => onMobileInput({ firing: true })}
            onPointerUp={() => onMobileInput({ firing: false })}
            onPointerCancel={() => onMobileInput({ firing: false })}
            aria-label="Tirer"
            className="w-16 h-16 rounded-full bg-[#eab308] text-[#11151c] flex items-center justify-center font-bold"
          >
            <Crosshair className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};
