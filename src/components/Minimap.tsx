/**
 * Compact SVG radar minimap of Cotonou centered around the Esplanade de l'Amazone
 * and Boulevard de la Marina. Zero gradients, crisp tabular coordinates.
 */
import React from 'react';
import type { MinimapBlip } from '../game/types';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  blips: MinimapBlip[];
}

export const Minimap: React.FC<MinimapProps> = ({ playerX, playerZ, blips }) => {
  // World bounds mapped to 120x120 radar SVG
  const toMapX = (wx: number) => ((wx + 105) / 210) * 120;
  const toMapY = (wz: number) => ((wz + 95) / 160) * 120;

  const px = toMapX(playerX);
  const py = toMapY(playerZ);

  return (
    <div className="w-[120px] h-[120px] bg-[#12161d]/90 border border-white/15 rounded-lg overflow-hidden relative">
      <svg viewBox="0 0 120 120" className="w-full h-full block">
        {/* Atlantic Ocean South strip */}
        <rect x="0" y={toMapY(36)} width="120" height="40" fill="#133d54" />
        {/* Boulevard de la Marina & Avenues */}
        <rect x="4" y={toMapY(21)} width="112" height="7" fill="#2e3440" />
        <rect x="8" y={toMapY(-31)} width="104" height="5" fill="#2e3440" />
        <rect x="8" y={toMapY(-81)} width="104" height="5" fill="#2e3440" />
        <rect x={toMapX(-38)} y={toMapY(-85)} width="5" height="90" fill="#2e3440" />
        <rect x={toMapX(34)} y={toMapY(-85)} width="5" height="90" fill="#2e3440" />
        {/* Esplanade de l'Amazone */}
        <rect
          x={toMapX(-26)}
          y={toMapY(-20)}
          width={toMapX(26) - toMapX(-26)}
          height={toMapY(16) - toMapY(-20)}
          fill="#4a4033"
        />

        {/* Dynamic entity blips */}
        {blips.map((b, idx) => {
          const bx = toMapX(b.x);
          const by = toMapY(b.z);
          if (b.type === 'amazone') {
            return (
              <polygon
                key={`am-${idx}`}
                points={`${bx},${by - 4.5} ${bx + 4},${by} ${bx},${by + 4.5} ${bx - 4},${by}`}
                fill="#eab308"
              />
            );
          }
          if (b.type === 'objective') {
            return <circle key={`obj-${idx}`} cx={bx} cy={by} r={3.6} fill="#f59e0b" stroke="#ffffff" strokeWidth="1" />;
          }
          if (b.type === 'enemy') {
            return <circle key={`en-${idx}`} cx={bx} cy={by} r={2.4} fill="#ef4444" />;
          }
          if (b.type === 'police') {
            return <circle key={`po-${idx}`} cx={bx} cy={by} r={2.4} fill="#3b82f6" />;
          }
          return <rect key={`ve-${idx}`} x={bx - 1.5} y={by - 1.5} width="3" height="3" fill="#94a3b8" />;
        })}

        {/* Player marker */}
        <circle cx={px} cy={py} r={3.2} fill="#ffffff" stroke="#0e1116" strokeWidth="1.2" />
      </svg>
    </div>
  );
};
