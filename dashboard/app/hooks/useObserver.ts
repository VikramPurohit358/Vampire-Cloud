'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConnectionState, Snapshot } from '@/app/types';
import { getMasterWsUrl } from '@/app/components/utils';

export function useObserver(url?: string) {
  const targetUrl = url || getMasterWsUrl('/observer');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const skewRef = useRef(0);
  const [clockSkew, setClockSkew] = useState(0);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setConnection(attempt === 0 ? 'connecting' : 'reconnecting');

      try {
        ws = new WebSocket(targetUrl);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        setConnection('live');
      };

      ws.onmessage = (ev) => {
        try {
          const raw = typeof ev.data === 'string' ? ev.data : '';
          const msg = JSON.parse(raw);
          if (msg && msg.type === 'state') {
            const snap = msg as Snapshot;
            if (typeof snap.ts === 'number' && Number.isFinite(snap.ts)) {
              skewRef.current = snap.ts - Date.now();
              setClockSkew(skewRef.current);
            }
            setSnapshot(snap);
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        try { ws?.close(); } catch { /* ignore */ }
      };

      ws.onclose = () => {
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      setConnection('reconnecting');
      const delay = Math.min(10_000, 500 * (2 ** Math.min(attempt, 8))) + Math.random() * 300;
      attempt++;
      timer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [targetUrl]);

  return { snapshot, connection, clockSkew };
}
