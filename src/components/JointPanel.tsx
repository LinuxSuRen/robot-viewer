import React, { useCallback, useState, useEffect, useRef } from 'react';
import type { JointInfo, JointAngles } from '../types';

interface JointPanelProps {
  joints: JointInfo[];
  onJointChange: (angles: JointAngles) => void;
}

export default function JointPanel({ joints, onJointChange }: JointPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [unit, setUnit] = useState<'rad' | 'deg'>('rad');
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    joints.forEach((j) => (init[j.name] = j.value));
    return init;
  });
  // Track whether a slider is currently being dragged (prevent sync fight)
  const draggingRef = useRef(false);

  // Sync local values from joints prop (e.g. backend push via WS)
  useEffect(() => {
    if (draggingRef.current) return;
    setValues((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const j of joints) {
        // Only take value from prop if different from local; keep local otherwise
        const propVal = j.value;
        const localVal = prev[j.name];
        if (localVal !== undefined && Math.abs(localVal - propVal) < 1e-6) {
          next[j.name] = localVal;
        } else {
          next[j.name] = propVal;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [joints]);

  const toDisplay = (rad: number) => (unit === 'deg' ? (rad * 180) / Math.PI : rad);
  const fromDisplay = (val: number) => (unit === 'deg' ? (val * Math.PI) / 180 : val);

  const handleChange = useCallback(
    (name: string, displayValue: number) => {
      draggingRef.current = true;
      const radValue = fromDisplay(displayValue);
      const newValues = { ...values, [name]: radValue };
      setValues(newValues);
      onJointChange({ [name]: radValue });
      // Clear dragging flag after a short delay (allow sync after user stops)
      setTimeout(() => { draggingRef.current = false; }, 300);
    },
    [values, onJointChange, fromDisplay]
  );

  const handleReset = useCallback(() => {
    const reset: Record<string, number> = {};
    joints.forEach((j) => (reset[j.name] = 0));
    setValues(reset);
    onJointChange(reset);
  }, [joints, onJointChange]);

  const toggleUnit = useCallback(() => {
    setUnit((u) => (u === 'rad' ? 'deg' : 'rad'));
  }, []);

  if (joints.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 p-3 shadow-2xl backdrop-blur">
        <p className="text-xs text-gray-500">No joints to control</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700/50 bg-gray-900/80 shadow-2xl backdrop-blur transition-all">
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="text-xs font-semibold text-gray-300">
          Joints ({joints.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleUnit();
            }}
            className="rounded bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-300 transition hover:bg-gray-600/50"
          >
            {unit === 'rad' ? 'rad' : 'deg'}
          </button>
          <span className="text-[10px] text-gray-500">{collapsed ? '+' : '-'}</span>
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto px-3 pb-3">
          {joints.map((joint) => (
            <div key={joint.name} className="mb-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-400 truncate max-w-[60%]" title={joint.name}>
                  {joint.name}
                </span>
                <span className="text-gray-300 tabular-nums">
                  {toDisplay(values[joint.name] ?? joint.value).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={toDisplay(joint.min)}
                max={toDisplay(joint.max)}
                step={(toDisplay(joint.max) - toDisplay(joint.min)) / 200}
                value={toDisplay(values[joint.name] ?? joint.value)}
                onChange={(e) => handleChange(joint.name, parseFloat(e.target.value))}
                className="mt-0.5 w-full accent-blue-500"
              />
            </div>
          ))}
          <button
            onClick={handleReset}
            className="mt-2 w-full rounded-lg bg-gray-700/30 py-1 text-[11px] text-gray-400 transition hover:bg-gray-600/30"
          >
            Reset All
          </button>
        </div>
      )}
    </div>
  );
}
