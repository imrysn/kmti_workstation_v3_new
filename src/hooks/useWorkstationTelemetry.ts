import { useState, useEffect, useRef, useCallback } from 'react';
import { telemetryApi } from '../services/api';
import { WorkstationStatus, AchievementInfo, detectNewUnlockedAchievement } from '../components/Achievement';

export function useWorkstationTelemetry(user: any) {
  const [workstations, setWorkstations] = useState<WorkstationStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [myComputerName, setMyComputerName] = useState<string>('');
  const [stats, setStats] = useState<{
    peak_users: number;
    waves_exchanged: number;
    wave_leader: string;
    most_active_module: string;
  } | null>(null);

  const [toasts, setToasts] = useState<{ id: string; sender: string; type?: 'wave' | 'login' | 'logout' }[]>([]);
  const [isWaving, setIsWaving] = useState<Record<string, boolean>>({});
  const [pendingAchievement, setPendingAchievement] = useState<AchievementInfo | null>(null);

  const prevAchievementsRef = useRef<Record<string, boolean>>({});
  const alreadyPoppedRef = useRef<Record<string, boolean>>({});
  const prevPingsRef = useRef<Record<string, { ping: string; module: string }>>({});
  const isInitialFetchRef = useRef(true);

  // Fetch local hostname/workstation name on mount
  useEffect(() => {
    if ((window as any).electronAPI?.getWorkstationInfo) {
      (window as any).electronAPI.getWorkstationInfo()
        .then((info: any) => {
          setMyComputerName(info.computerName);
        })
        .catch(() => {
          const name = sessionStorage.getItem('kmti_dev_name') || 'Browser';
          setMyComputerName(name);
        });
    } else {
      const name = sessionStorage.getItem('kmti_dev_name') || 'Browser';
      setMyComputerName(name);
    }
  }, []);

  // Listen to received waves
  useEffect(() => {
    const handleWave = (e: any) => {
      const sender = e.detail?.sender || 'Someone';
      const newToast = { id: Math.random().toString(), sender };
      setToasts(prev => [...prev, newToast]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 4500);
    };

    window.addEventListener('kmti:wave-received', handleWave);
    return () => window.removeEventListener('kmti:wave-received', handleWave);
  }, []);

  // Listen to real-time login & logout events via Socket.IO
  useEffect(() => {
    const socket = (window as any).kmtiSocket;
    if (!socket) return;

    const handleUserStatusEvent = (data: { type?: 'login' | 'logout'; username?: string; displayName?: string }) => {
      if (!data || !data.username) return;
      if (user && user.username && data.username.toLowerCase() === user.username.toLowerCase()) return;

      const senderName = data.displayName || data.username;
      const toastId = Math.random().toString();
      const toastType = data.type === 'logout' ? 'logout' : 'login';

      setToasts(prev => [...prev, { id: toastId, sender: senderName, type: toastType }]);

      window.dispatchEvent(
        new CustomEvent('kmti:user-presence-change', {
          detail: { type: toastType, username: senderName }
        })
      );

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toastId));
      }, 4500);
    };

    socket.on('user_status_event', handleUserStatusEvent);
    return () => {
      socket.off('user_status_event', handleUserStatusEvent);
    };
  }, [user]);

  const detectNewAchievements = useCallback((newWorkstations: WorkstationStatus[]) => {
    const result = detectNewUnlockedAchievement(
      newWorkstations,
      myComputerName,
      user?.username,
      prevAchievementsRef.current
    );
    
    if (result && !alreadyPoppedRef.current[result.key]) {
      alreadyPoppedRef.current[result.key] = true;
      setPendingAchievement({ key: result.key, ...result.info });
    }

    const myWs = newWorkstations.find(
      ws => ws.computer_name === myComputerName && myComputerName !== ''
    );
    if (myWs?.achievements) {
      prevAchievementsRef.current = { ...(myWs.achievements as Record<string, boolean>) };
    }
  }, [myComputerName, user?.username]);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await telemetryApi.getStats({ signal });
      if (res.data?.success) {
        setStats(res.data);
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.message !== 'canceled') {
        console.error('[ONLINE DRAWER] Failed to fetch shift statistics:', err);
      }
    }
  }, []);

  const fetchWorkstations = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const res = await telemetryApi.getStatuses({ signal, params: { include_offline: true } });
      if (res.data?.data) {
        const rawWorkstations: WorkstationStatus[] = res.data.data;

        // Deduplicate by computer_name (fallback: ip_address), keeping the most recently pinged entry.
        // Duplicate rows can appear when the same machine reconnects without the old row expiring.
        const wsMap = new Map<string, WorkstationStatus>();
        for (const ws of rawWorkstations) {
          const key = (ws.computer_name || ws.ip_address || '').toLowerCase();
          if (!key) continue;
          const existing = wsMap.get(key);
          if (!existing) {
            wsMap.set(key, ws);
          } else {
            // Keep whichever row has the more recent last_ping
            const existingTime = existing.last_ping ? new Date(existing.last_ping).getTime() : 0;
            const newTime = ws.last_ping ? new Date(ws.last_ping).getTime() : 0;
            if (newTime > existingTime) wsMap.set(key, ws);
          }
        }
        const newWorkstations: WorkstationStatus[] = Array.from(wsMap.values());

        setWorkstations(newWorkstations);
        detectNewAchievements(newWorkstations);

        const newPingsMap: Record<string, { ping: string; module: string }> = {};

        newWorkstations.forEach(ws => {
          const compName = ws.computer_name || ws.ip_address;
          if (ws.last_ping) {
            newPingsMap[compName] = { ping: ws.last_ping, module: ws.active_module || '' };
          }
        });

        prevPingsRef.current = newPingsMap;
        if (isInitialFetchRef.current) {
          isInitialFetchRef.current = false;
        }
      }
    } catch (err: any) {
      if (err.name !== 'CanceledError' && err.message !== 'canceled') {
        console.error('[ONLINE DRAWER] Failed to fetch telemetry statuses:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [detectNewAchievements]);

  // Optimistic UI: update local active_module immediately when the user switches app
  // modules, instead of waiting for the next 15-second telemetry poll.
  useEffect(() => {
    const handleModuleChanged = (e: any) => {
      const { computerName, module } = e.detail || {};
      if (!computerName || !module) return;
      setWorkstations(prev =>
        prev.map(ws =>
          ws.computer_name === computerName
            ? { ...ws, active_module: module, last_ping: new Date().toISOString() }
            : ws
        )
      );
    };
    window.addEventListener('kmti:module-changed', handleModuleChanged);
    return () => window.removeEventListener('kmti:module-changed', handleModuleChanged);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkstations(controller.signal);
    fetchStats(controller.signal);

    const interval = setInterval(() => {
      fetchWorkstations(controller.signal);
      fetchStats(controller.signal);
    }, 15000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [detectNewAchievements]);

  const handleSendWave = async (targetCompName: string) => {
    const sender = myComputerName || user?.username || 'Guest';
    if (!targetCompName) return;

    if (isWaving[targetCompName]) return;
    setIsWaving(prev => ({ ...prev, [targetCompName]: true }));

    try {
      await telemetryApi.wave(sender, targetCompName);
    } catch (err) {
      console.error('Failed to send wave:', err);
    }

    setTimeout(() => {
      setIsWaving(prev => ({ ...prev, [targetCompName]: false }));
    }, 3500);
  };

  return {
    workstations,
    isLoading,
    stats,
    myComputerName,
    toasts,
    isWaving,
    pendingAchievement,
    setPendingAchievement,
    fetchWorkstations,
    handleSendWave
  };
}
