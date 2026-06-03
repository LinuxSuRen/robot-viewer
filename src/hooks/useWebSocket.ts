import { useCallback, useEffect, useRef, useState } from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

interface UseWebSocketOptions {
  onMessage: (data: unknown) => void;
  reconnectInterval?: number;
  maxReconnectBackoff?: number;
}

export function useWebSocket(path: string, options: UseWebSocketOptions) {
  const { onMessage, reconnectInterval = 2000, maxReconnectBackoff = 30000 } = options;
  const [state, setState] = useState<ConnectionState>('disconnected');
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBackoffRef = useRef(reconnectInterval);
  const mountedRef = useRef(true);

  const buildUrl = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    // Backend is proxied through Vite on same origin, or direct connect
    return `${proto}://${location.host}${path}`;
  }, [path]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState('connecting');
    const url = buildUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setState('connected');
      currentBackoffRef.current = reconnectInterval;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const parsed = JSON.parse(event.data as string);
        onMessageRef.current(parsed);
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setState('disconnected');
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect handled in onclose
      ws.close();
    };
  }, [buildUrl, reconnectInterval]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, currentBackoffRef.current);
    // Exponential backoff capped at maxReconnectBackoff
    currentBackoffRef.current = Math.min(
      currentBackoffRef.current * 2,
      maxReconnectBackoff,
    );
  }, [connect, maxReconnectBackoff]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState('disconnected');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { state, reconnect: connect };
}
