import { useCallback, useRef, useState, useEffect } from 'react';
import type { JointAngles, JointInfo } from '../types';
import * as api from '../api/client';
import { useWebSocket } from './useWebSocket';

export function useJointControl(onBackendUpdate?: (angles: JointAngles) => void) {
  const [joints, setJoints] = useState<JointInfo[]>([]);
  const jointsRef = useRef<JointInfo[]>([]);
  jointsRef.current = joints;
  const [syncing, setSyncing] = useState(false);
  const onBackendUpdateRef = useRef(onBackendUpdate);
  onBackendUpdateRef.current = onBackendUpdate;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyJointsFromData = useCallback((data: JointAngles) => {
    if (!data || typeof data !== 'object') return;
    const curr = jointsRef.current;
    if (curr.length > 0) {
      setJoints(prev => prev.map(j => ({
        ...j,
        value: data[j.name] ?? j.value,
      })));
    }
    onBackendUpdateRef.current?.(data);
  }, []);

  // WebSocket: receive joint updates pushed from backend in real time
  const handleWsMessage = useCallback((data: unknown) => {
    applyJointsFromData(data as JointAngles);
  }, [applyJointsFromData]);

  const { state: wsState, reconnect: wsReconnect } = useWebSocket(
    '/ws/viewer',
    { onMessage: handleWsMessage, reconnectInterval: 2000 },
  );

  // Fallback polling: if WS stays disconnected, poll HTTP every 500ms
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const data = await api.fetchJoints();
      if (data) applyJointsFromData(data);
    }, 500);
  }, [applyJointsFromData]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (wsState === 'connected') {
      stopPolling();
    } else if (wsState === 'disconnected') {
      // Start polling after 3s of disconnected WS
      const timer = setTimeout(startPolling, 3000);
      return () => clearTimeout(timer);
    }
  }, [wsState, startPolling, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // POST joint updates from UI slider to backend
  const updateBackend = useCallback(async (angles: JointAngles) => {
    if (syncing) return;
    setSyncing(true);
    try {
      await api.updateJoints(angles);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return {
    joints,
    setJoints,
    updateBackend,
    wsState,
    wsReconnect,
  };
}
