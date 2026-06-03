import { useCallback, useRef, useState, useEffect } from 'react';
import type { ViewerHandle, FileMap } from '../types';

export function useSceneManager() {
  const viewerRef = useRef<ViewerHandle>(null);

  const loadURDF = useCallback(async (file: File) => {
    return viewerRef.current?.loadURDF(file) ?? null;
  }, []);

  const loadMesh = useCallback(async (file: File, name: string) => {
    return viewerRef.current?.loadMesh(file, name);
  }, []);

  const setFileMap = useCallback((fileMap: FileMap, workingDir: string) => {
    viewerRef.current?.setFileMap(fileMap, workingDir);
  }, []);

  const setJointAngles = useCallback((angles: Record<string, number>) => {
    viewerRef.current?.setJointAngles(angles);
  }, []);

  const clearScene = useCallback(() => {
    viewerRef.current?.clearScene();
  }, []);

  const setAxesVisible = useCallback((visible: boolean) => {
    viewerRef.current?.setAxesVisible(visible);
  }, []);

  const setGridVisible = useCallback((visible: boolean) => {
    viewerRef.current?.setGridVisible(visible);
  }, []);

  const setWireframe = useCallback((enabled: boolean) => {
    viewerRef.current?.setWireframe(enabled);
  }, []);

  const resetCamera = useCallback((position: [number, number, number]) => {
    viewerRef.current?.resetCamera(position);
  }, []);

  const setBackgroundColor = useCallback((color: string) => {
    viewerRef.current?.setBackgroundColor(color);
  }, []);

  return {
    viewerRef,
    loadURDF,
    loadMesh,
    setFileMap,
    setJointAngles,
    clearScene,
    setAxesVisible,
    setGridVisible,
    setWireframe,
    resetCamera,
    setBackgroundColor,
  };
}
