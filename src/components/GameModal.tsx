/**
 * Clean Pause, Victory, and Game Over modal dialogs over the 3D Cotonou viewport.
 * Flat dark surfaces, no backdrop-filter, plain human French controls.
 */
import React from 'react';
import { Award, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import type { GamePhase } from '../game/types';

interface GameModalProps {
  phase: Exclude<GamePhase, 'title' | 'playing'>;
  cash: number;
  gameoverReason: 'dead' | 'arrested';
  onResume: () => void;
  onContinueFreeRoam: () => void;
  onPayBail: () => void;
  onRestart: () => void;
}

export const GameModal: React.FC<GameModalProps> = ({
  phase,
  cash,
  gameoverReason,
  onResume,
  onContinueFreeRoam,
  onPayBail,
  onRestart,
}) => {
  const isPause = phase === 'paused';
  const isVictory = phase === 'victory';
  const isArrested = phase === 'gameover' && gameoverReason === 'arrested';

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-[#12161d] border border-white/15 rounded-xl p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          {isVictory ? (
            <Award className="w-7 h-7 text-[#eab308] shrink-0" />
          ) : isPause ? (
            <Play className="w-6 h-6 text-[#eab308] shrink-0" />
          ) : (
            <ShieldAlert className={`w-7 h-7 shrink-0 ${isArrested ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          )}
          <h2 className="font-display text-2xl font-bold text-[#f5f2eb]">
            {isPause
              ? 'Pause'
              : isVictory
                ? 'Roi de Cotonou'
                : isArrested
                  ? 'Interpellé · Police Républicaine'
                  : 'À terre'}
          </h2>
        </div>

        <div className="flex items-center justify-between py-3 border-y border-white/10 text-sm">
          <span className="text-[#a8a296]">Butin accumulé</span>
          <span className="font-mono-tabular font-bold text-[#eab308] text-base">
            {cash.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {isPause && (
            <button
              type="button"
              onClick={onResume}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-sm hover:bg-[#facc15] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Reprendre</span>
            </button>
          )}

          {isVictory && (
            <button
              type="button"
              onClick={onContinueFreeRoam}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-sm hover:bg-[#facc15] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mode Libre</span>
            </button>
          )}

          {isArrested && cash >= 15000 && (
            <button
              type="button"
              onClick={onPayBail}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-sm hover:bg-[#facc15] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Caution (-15 000)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestart}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#1e2430] border border-white/15 text-[#f5f2eb] font-display font-bold text-sm hover:bg-[#2a3242] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rejouer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
