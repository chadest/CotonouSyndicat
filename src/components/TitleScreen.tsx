/**
 * Full-viewport Title Screen layered over the live 3D camera orbiting
 * the Monument Amazone on Cotonou's Esplanade.
 * Features a bespoke inline SVG title lockup, primary Start CTA, and 1-line controls hint.
 */
import React from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onToggleAnthem?: () => void;
  anthemPlaying?: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  muted,
  onToggleMute,
  onToggleAnthem,
  anthemPlaying,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none">
      {/* Top bar: National anthem audio & sound toggle */}
      <div className="flex justify-end pointer-events-auto">
        <div className="flex items-center gap-2.5">
          {onToggleAnthem && (
            <button
              type="button"
              onClick={onToggleAnthem}
              aria-label={anthemPlaying ? "Arrêter l'Hymne National" : "Écouter l'Hymne National (Wikipédia)"}
              className={`h-11 px-3.5 flex items-center gap-2 rounded-lg border text-xs font-semibold tracking-wide transition-colors cursor-pointer ${
                anthemPlaying
                  ? 'bg-[#1a2330] border-[#eab308] text-[#eab308]'
                  : 'bg-[#12161d]/90 border-white/15 text-[#f5f2eb] hover:bg-[#1e2430]'
              }`}
            >
              <div className="flex w-4 h-3 rounded-xs overflow-hidden shadow-xs shrink-0">
                <div className="w-1.5 h-full bg-[#008751]" />
                <div className="flex flex-col w-2.5 h-full">
                  <div className="h-1/2 bg-[#fcd116]" />
                  <div className="h-1/2 bg-[#e8112d]" />
                </div>
              </div>
              <span>{anthemPlaying ? "Hymne en cours..." : "Hymne National (Wikipédia)"}</span>
              {anthemPlaying && (
                <span className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-3 bg-[#008751] animate-pulse rounded-full" />
                  <span className="w-1 h-2 bg-[#fcd116] animate-pulse rounded-full" />
                  <span className="w-1 h-3 bg-[#e8112d] animate-pulse rounded-full" />
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            className="h-11 w-11 flex items-center justify-center rounded-lg bg-[#12161d]/90 border border-white/15 text-[#f5f2eb] hover:bg-[#1e2430] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Left-aligned Title Lockup leaving center/right calm for the 3D Statue de l'Amazone */}
      <div className="max-w-xl bg-[#11151c]/88 border border-white/15 rounded-xl p-6 md:p-8 pointer-events-auto">
        {/* Bespoke Inline SVG Title Lockup */}
        <svg
          viewBox="0 0 420 92"
          className="w-full max-w-[380px] h-auto mb-5"
          role="img"
          aria-label="Cotonou Syndicat"
        >
          {/* Stylized Monument Amazone Spear & Shield Crest */}
          <polygon points="24,8 30,22 24,26 18,22" fill="#eab308" />
          <rect x="22.5" y="24" width="3" height="58" fill="#eab308" />
          <polygon points="8,42 40,42 35,66 24,76 13,66" fill="none" stroke="#eab308" strokeWidth="2.5" />
          <line x1="15" y1="53" x2="33" y2="53" stroke="#eab308" strokeWidth="2" />

          {/* Title Typography */}
          <text
            x="56"
            y="43"
            fill="#f5f2eb"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="36"
            letterSpacing="2"
          >
            COTONOU
          </text>
          <text
            x="56"
            y="76"
            fill="#eab308"
            fontFamily="Chakra Petch, sans-serif"
            fontWeight="700"
            fontSize="28"
            letterSpacing="5"
          >
            SYNDICAT
          </text>
        </svg>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-base tracking-wide hover:bg-[#facc15] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Jouer</span>
          </button>
        </div>
      </div>

      {/* Single flat control-hint line at bottom */}
      <div className="flex justify-center">
        <div className="px-4 py-2 rounded-lg bg-[#11151c]/88 border border-white/12 text-xs md:text-sm text-[#d6d0c4] tracking-wide text-center">
          ZQSD / Flèches Déplacer · Clic / Espace Tirer · F / E Véhicule · C Caméra Intérieure · Échap Pause
        </div>
      </div>
    </div>
  );
};
