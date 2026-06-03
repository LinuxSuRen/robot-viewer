import React, { useState, useCallback, useEffect } from 'react';
import ViewerCanvas from './components/ViewerCanvas';
import FileDropZone from './components/FileDropZone';
import JointPanel from './components/JointPanel';
import Toolbar from './components/Toolbar';
import { useSceneManager } from './hooks/useSceneManager';
import { useJointControl } from './hooks/useJointControl';
import * as api from './api/client';
import type { CameraPreset, FileMap } from './types';

const cameraPositions: Record<CameraPreset, [number, number, number]> = {
  front: [0, 1, 5],
  back: [0, 1, -5],
  top: [0, 5, 0],
  bottom: [0, -5, 0],
  right: [5, 1, 0],
  left: [-5, 1, 0],
};

const BG_COLOR_KEY = 'robot-viewer-bg-color';
const DEFAULT_BG_COLOR = '#111827';

function loadBgColor(): string {
  try {
    return localStorage.getItem(BG_COLOR_KEY) || DEFAULT_BG_COLOR;
  } catch {
    return DEFAULT_BG_COLOR;
  }
}

function saveBgColor(color: string) {
  try {
    localStorage.setItem(BG_COLOR_KEY, color);
  } catch { /* noop */ }
}

interface PendingModel {
  file: File;
  relativePath: string;
}

export default function App() {
  const { viewerRef, loadURDF, loadMesh, setFileMap, setJointAngles, setAxesVisible, setGridVisible, setWireframe, resetCamera, setBackgroundColor } =
    useSceneManager();
  const handleBackendUpdate = useCallback(
    (angles: Record<string, number>) => {
      setJointAngles(angles);
    },
    [setJointAngles]
  );
  const { joints, setJoints, updateBackend, wsState } = useJointControl(handleBackendUpdate);

  const [axesVisible, setAxesVisibleState] = useState(false);
  const [gridVisible, setGridVisibleState] = useState(true);
  const [wireframe, setWireframeState] = useState(false);
  const [modelName, setModelName] = useState('');
  const [bgColor, setBgColor] = useState(loadBgColor);
  const [pendingModels, setPendingModels] = useState<PendingModel[] | null>(null);
  const [availableModels, setAvailableModels] = useState<PendingModel[] | null>(null);

  const doLoadModel = useCallback(async (modelFile: File) => {
    const result = await loadURDF(modelFile);
    if (result) {
      setJoints(result.joints);
      setModelName(modelFile.name);
      await api.updateModelInfo({
        name: modelFile.name,
        jointCount: result.joints.length,
        linkCount: 0,
      });
    }
  }, [loadURDF, setJoints]);

  const handleFileLoad = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (['urdf', 'xacro'].includes(ext || '')) {
        const result = await loadURDF(file);
        if (result) {
          setJoints(result.joints);
          setModelName(file.name);
          await api.updateModelInfo({
            name: file.name,
            jointCount: result.joints.length,
            linkCount: 0,
          });
        }
      } else if (['stl', 'obj', 'dae', 'glb', 'gltf'].includes(ext || '')) {
        await loadMesh(file, file.name);
        setJoints([]);
        setModelName(file.name);
        setAxesVisibleState(true);
        setAxesVisible(true);
      }
    },
    [loadURDF, loadMesh, setJoints, setAxesVisible]
  );

  const handleDirectoryLoad = useCallback(
    async (files: File[]) => {

      // Build file map keyed by webkitRelativePath
      const fileMap: FileMap = new Map();
      const modelFiles: PendingModel[] = [];
      let rootDir = '';

      for (const file of files) {
        const path = file.webkitRelativePath || file.name;
        const normalizedPath = path.replaceAll('\\', '/');
        fileMap.set(normalizedPath, file);

        // Extract root directory name from first file
        if (!rootDir) {
          const parts = normalizedPath.split('/');
          if (parts.length > 1) {
            rootDir = parts[0] + '/';
          }
        }

        const ext = normalizedPath.split('.').pop()?.toLowerCase();
        if (ext === 'urdf' || ext === 'xacro') {
          modelFiles.push({ file, relativePath: normalizedPath });
        }
      }

      if (modelFiles.length === 0) {
        console.warn('No URDF or Xacro file found in directory');
        return;
      }

      // Set the file map for mesh resolution
      setFileMap(fileMap, rootDir);

      setAvailableModels(modelFiles);

      if (modelFiles.length === 1) {
        await doLoadModel(modelFiles[0].file);
      } else {
        setPendingModels(modelFiles);
      }
    },
    [setFileMap, doLoadModel]
  );

  const handleSelectModel = useCallback(async (model: PendingModel) => {
    setPendingModels(null);
    await doLoadModel(model.file);
  }, [doLoadModel]);

  const handleSwitchModel = useCallback(() => {
    if (availableModels) {
      setPendingModels(availableModels);
    }
  }, [availableModels]);

  const handleJointChange = useCallback(
    (angles: Record<string, number>) => {
      setJointAngles(angles);
      updateBackend(angles);
    },
    [setJointAngles, updateBackend]
  );

  const handleCameraPreset = useCallback(
    (preset: CameraPreset) => {
      resetCamera(cameraPositions[preset]);
    },
    [resetCamera]
  );

  const handleToggleAxes = useCallback(() => {
    const next = !axesVisible;
    setAxesVisible(next);
    setAxesVisibleState(next);
  }, [axesVisible, setAxesVisible]);

  const handleToggleGrid = useCallback(() => {
    const next = !gridVisible;
    setGridVisible(next);
    setGridVisibleState(next);
  }, [gridVisible, setGridVisible]);

  const handleToggleWireframe = useCallback(() => {
    const next = !wireframe;
    setWireframe(next);
    setWireframeState(next);
  }, [wireframe, setWireframe]);

  const handleBgColorChange = useCallback(
    (color: string) => {
      setBgColor(color);
      setBackgroundColor(color);
      saveBgColor(color);
    },
    [setBackgroundColor]
  );

  // Apply saved background color on mount (after scene init)
  useEffect(() => {
    const timer = setTimeout(() => setBackgroundColor(bgColor), 100);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleGlobalDragOver = (e: DragEvent) => e.preventDefault();
    const handleGlobalDrop = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gray-950">
      <ViewerCanvas ref={viewerRef} />
      <FileDropZone onFileLoad={handleFileLoad} onDirectoryLoad={handleDirectoryLoad} />
      <Toolbar
        onCameraPreset={handleCameraPreset}
        axesVisible={axesVisible}
        gridVisible={gridVisible}
        wireframe={wireframe}
        onToggleAxes={handleToggleAxes}
        onToggleGrid={handleToggleGrid}
        onToggleWireframe={handleToggleWireframe}
        modelName={modelName}
        onSwitchModel={availableModels && availableModels.length > 1 ? handleSwitchModel : undefined}
        wsState={wsState}
        bgColor={bgColor}
        onBgColorChange={handleBgColorChange}
      />
      {joints.length > 0 && (
        <div className="fixed left-4 top-16 z-40 w-56">
          <JointPanel joints={joints} onJointChange={handleJointChange} />
        </div>
      )}

      {pendingModels && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPendingModels(null)}
        >
          <div
            className="w-96 rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-1 text-sm font-semibold text-gray-200">选择模型文件</h2>
            <p className="mb-3 text-[11px] text-gray-500">
              目录中发现 {pendingModels.length} 个模型文件，请选择要加载的：
            </p>
            <div className="space-y-1">
              {pendingModels.map((m) => (
                <button
                  key={m.relativePath}
                  onClick={() => handleSelectModel(m)}
                  className="w-full rounded-lg border border-gray-700/60 bg-gray-800/50 px-3 py-2 text-left text-[12px] text-gray-300 transition hover:border-blue-500/50 hover:bg-gray-700/50"
                >
                  {m.relativePath}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingModels(null)}
              className="mt-3 w-full rounded-lg bg-gray-800 py-2 text-[12px] text-gray-400 transition hover:bg-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
