/**
 * Floating Camera Control Gizmo widget for rotating and zooming the 3D Cotonou environment view.
 */
import React from 'react';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

interface CameraGizmoProps {
  onOrbit: (delta: number) => void;
  onZoom: (delta: number) => void;
}

export const CameraGizmo: React.FC<CameraGizmoProps> = ({ onOrbit, onZoom }) => {
  return (
    <div className="pointer-events-auto bg-[#12161d]/90 border border-white/15 rounded-xl p-2.5 flex items-center gap-2 shadow-lg">
      <button
        type="button"
        onClick={() => onOrbit(-0.35)}
        aria-label="Pivoter la caméra à gauche"
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1a202c] text-[#f5f2eb] hover:bg-[#283244] transition-colors cursor-pointer"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onOrbit(0.35)}
        aria-label="Pivoter la caméra à droite"
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1a202c] text-[#f5f2eb] hover:bg-[#283244] transition-colors cursor-pointer"
      >
        <RotateCw className="w-4 h-4" />
      </button>
      <div className="w-[1px] h-6 bg-white/15 mx-0.5" />
      <button
        type="button"
        onClick={() => onZoom(-1.5)}
        aria-label="Zoomer la caméra"
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1a202c] text-[#f5f2eb] hover:bg-[#283244] transition-colors cursor-pointer"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onZoom(1.5)}
        aria-label="Dézoomer la caméra"
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-[#1a202c] text-[#f5f2eb] hover:bg-[#283244] transition-colors cursor-pointer"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
    </div>
  );
};
