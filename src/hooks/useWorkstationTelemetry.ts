import { useState, useEffect, useRef, useCallback } from 'react';
import { telemetryApi } from '../services/api';
import { WorkstationStatus, AchievementInfo, detectNewUnlockedAchievement } from '../components/Achievement';
import { getDisplayName } from '../utils/nameUtils';

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

  const [toasts, setToasts] = useState<{ id: string; sender: string; type?: 'wave' | 'login' }[]>([]);
  const [isWaving, setIsWaving] = useState<Record<string, boolean>>({});
  const [pendingAchievement, setPendingAchievement] = useState<AchievementInfo | null>(null);

  const prevAchievementsRef = useRef<Record<string, boolean>>({});
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

  const detectNewAchievements = useCallback((newWorkstations: WorkstationStatus[]) => {
    const result = detectNewUnlockedAchievement(
      newWorkstations,
      myComputerName,
      user?.username,
      prevAchievementsRef.current
    );
    if (result) {
      setPendingAchievement({ key: result.key, ...result.info });
    }

    const myWs = newWorkstations.find(
      ws => ws.computer_name === myComputerName && myComputerName !== ''
    );
    if (myWs?.achievements) {
      prevAchievementsRef.current = { ...(myWs.achievements as Record<string, boolean>) };
    }
  }, [myComputerName, user?.username]);

  const fetchStats = async (signal?: AbortSignal) => {
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
  };

  const fetchWorkstations = async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const res = await telemetryApi.getStatuses({ signal, params: { include_offline: true } });
      if (res.data?.data) {
        const newWorkstations: WorkstationStatus[] = res.data.data;
        setWorkstations(newWorkstations);
        detectNewAchievements(newWorkstations);

        const nowMs = Date.now();
        const newPingsMap: Record<string, { ping: string; module: string }> = {};
        const fiveMins = 5 * 60 * 1000;

        newWorkstations.forEach(ws => {
          const compName = ws.computer_name || ws.ip_address;
          if (ws.last_ping) {
            newPingsMap[compName] = { ping: ws.last_ping, module: ws.active_module || '' };

            if (!isInitialFetchRef.current) {
              const prevState = prevPingsRef.current[compName];
              if (prevState) {
                const prevPingMs = new Date(prevState.ping).getTime();
                const newPingMs = new Date(ws.last_ping).getTime();

                const wasGenuinelyOffline = (nowMs - prevPingMs >= fiveMins) || (prevState.module === 'offline');
                const isNowOnline = (nowMs - newPingMs < fiveMins) && (ws.active_module !== 'offline');

                if (wasGenuinelyOffline && isNowOnline) {
                  const toastId = Math.random().toString();
                  const name = ws.display_name || getDisplayName(ws.current_user || '') || ws.current_user || compName;
                  setToasts(prev => [...prev, { id: toastId, sender: name, type: 'login' }]);

                  setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== toastId));
                  }, 4500);
                }
              }
            }
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
  };

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
