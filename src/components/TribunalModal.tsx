/**
 * Tribunal de Cotonou courtroom trial modal dialog.
 * Allows the arrested player to pay bail or restart the game.
 */
import React from 'react';
import { Gavel, Play, RotateCcw } from 'lucide-react';

interface TribunalModalProps {
  cash: number;
  onPayBail: () => void;
  onRestart: () => void;
}

export const TribunalModal: React.FC<TribunalModalProps> = ({ cash, onPayBail, onRestart }) => {
  const canBail = cash >= 15000;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-lg bg-[#12161d] border border-white/15 rounded-xl p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Gavel className="w-7 h-7 text-[#eab308] shrink-0" />
          <h2 className="font-display text-2xl font-bold text-[#f5f2eb]">
            Tribunal de Cotonou · Procès
          </h2>
        </div>

        <p className="text-sm text-[#d6d0c4] leading-relaxed">
          Accusé d’infractions graves aux lois de la République du Bénin et de trouble à l’ordre public sur l’Esplanade de l’Amazone par la Police Républicaine. Le juge examine le dossier de comparution immédiate.
        </p>

        <div className="flex items-center justify-between py-3 border-y border-white/10 text-sm">
          <span className="text-[#a8a296]">Butin / Fonds disponibles</span>
          <span className="font-mono-tabular font-bold text-[#eab308] text-base">
            {cash.toLocaleString('fr-FR')} FCFA
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {canBail ? (
            <button
              type="button"
              onClick={onPayBail}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#eab308] text-[#11151c] font-display font-bold text-sm hover:bg-[#facc15] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Payer la Caution (15 000 FCFA)</span>
            </button>
          ) : (
            <div className="flex-1 text-center py-3 text-xs text-[#ef4444]">
              Fonds insuffisants pour verser la caution (15 000 FCFA requis).
            </div>
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
