import React, { useState, useCallback } from 'react';
import type { CameraPreset } from '../types';
import ApiModal from './ApiModal';

interface ToolbarProps {
  onCameraPreset: (preset: CameraPreset) => void;
  axesVisible: boolean;
  gridVisible: boolean;
  wireframe: boolean;
  onToggleAxes: () => void;
  onToggleGrid: () => void;
  onToggleWireframe: () => void;
  modelName: string;
  wsState?: 'disconnected' | 'connecting' | 'connected';
  bgColor: string;
  onBgColorChange: (color: string) => void;
}

const presets: { label: string; preset: CameraPreset }[] = [
  { label: '+Z', preset: 'front' },
  { label: '-Z', preset: 'back' },
  { label: '+Y', preset: 'top' },
  { label: '-Y', preset: 'bottom' },
  { label: '+X', preset: 'right' },
  { label: '-X', preset: 'left' },
];

const bgPresets = [
  { label: 'Dark', color: '#111827' },
  { label: 'Slate', color: '#1e293b' },
  { label: 'Navy', color: '#0f172a' },
  { label: 'Neutral', color: '#262626' },
  { label: 'Zinc', color: '#27272a' },
  { label: 'Amber', color: '#1c1917' },
  { label: 'Gray', color: '#6b7280' },
  { label: 'White', color: '#f3f4f6' },
];

export default function Toolbar({
  onCameraPreset,
  axesVisible,
  gridVisible,
  wireframe,
  onToggleAxes,
  onToggleGrid,
  onToggleWireframe,
  modelName,
  wsState,
  bgColor,
  onBgColorChange,
}: ToolbarProps) {
  const [bgOpen, setBgOpen] = useState(false);

  return (
    <div className="fixed left-1/2 top-5 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-700/50 bg-gray-900/80 px-2 py-1.5 shadow-2xl backdrop-blur">
      <div className="mr-2 flex items-center gap-1 border-r border-gray-600/40 pr-2">
        {presets.map(({ label, preset }) => (
          <button
            key={preset}
            onClick={() => onCameraPreset(preset)}
            className="rounded-md px-1.5 py-0.5 text-[11px] text-gray-400 transition hover:bg-gray-700/60 hover:text-white"
            title={preset}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onToggleAxes}
        className={`rounded-md px-2 py-0.5 text-[11px] transition ${
          axesVisible
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
        }`}
      >
        Axes
      </button>
      <button
        onClick={onToggleGrid}
        className={`rounded-md px-2 py-0.5 text-[11px] transition ${
          gridVisible
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
        }`}
      >
        Grid
      </button>
      <button
        onClick={onToggleWireframe}
        className={`rounded-md px-2 py-0.5 text-[11px] transition ${
          wireframe
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-700/60 hover:text-white'
        }`}
      >
        Wire
      </button>

      {/* BG color picker */}
      <BgColorButton
        bgColor={bgColor}
        onBgColorChange={onBgColorChange}
        open={bgOpen}
        onToggle={() => setBgOpen((v) => !v)}
      />

      {modelName && (
        <span className="ml-2 border-l border-gray-600/40 pl-2 text-[11px] text-gray-500 truncate max-w-[120px]">
          {modelName}
        </span>
      )}
      <span className="ml-2 border-l border-gray-600/40 pl-2">
        <ApiModal />
      </span>
      {wsState && (
        <span className="ml-1 flex items-center gap-1 text-[10px] text-gray-500">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              wsState === 'connected'
                ? 'bg-green-500'
                : wsState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-red-500'
            }`}
          />
          WS
        </span>
      )}
    </div>
  );
}

function BgColorButton({
  bgColor,
  onBgColorChange,
  open,
  onToggle,
}: {
  bgColor: string;
  onBgColorChange: (color: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-gray-400 transition hover:bg-gray-700/60 hover:text-white"
      >
        <span
          className="inline-block h-3 w-3 rounded border border-gray-600"
          style={{ backgroundColor: bgColor }}
        />
        BG
      </button>

      {open && (
        <>
          {/* click-away overlay */}
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-xl border border-gray-700 bg-gray-900/95 p-2 shadow-2xl backdrop-blur">
            <div className="mb-1.5 grid grid-cols-4 gap-1">
              {bgPresets.map((p) => (
                <button
                  key={p.color}
                  onClick={() => onBgColorChange(p.color)}
                  className="flex h-6 w-6 items-center justify-center rounded border border-gray-600 text-[8px] transition hover:scale-110"
                  style={{ backgroundColor: p.color }}
                  title={p.label}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] text-gray-500">#</label>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => onBgColorChange(e.target.value)}
                className="h-5 w-full cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
