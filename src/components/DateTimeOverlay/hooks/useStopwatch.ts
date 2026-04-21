import { useState, useEffect, useRef } from 'react';
import { StopwatchRecord } from '../types';
import { STORAGE_KEY } from '../constants';

/**
 * Persist just the stopwatch fields into the existing settings blob.
 * Called immediately on toggle so swStartTime is never lost to a logout/crash.
 */
function persistSwState(swRunning: boolean, swAccumulated: number, swStartTime: number | null) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : {};
    data.swRunning = swRunning;
    data.swAccumulated = swAccumulated;
    data.swStartTime = swStartTime;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[useStopwatch] Failed to persist sw state', e);
  }
}

export const useStopwatch = (initialSettings: any) => {
  // If the app was closed/logged-out while running, reconstruct the elapsed
  // time from the saved startTime instead of starting from zero.
  const wasRunning = initialSettings.swRunning || false;
  const savedStart = Number(initialSettings.swStartTime) || null;
  const savedAccumulated = Number(initialSettings.swAccumulated) || 0;

  const restoredAccumulated = wasRunning && savedStart
    ? savedAccumulated + (Date.now() - savedStart)
    : savedAccumulated;

  // If it was running before refresh/logout, restore it as still running from now.
  // swAccumulated holds all elapsed time up to the refresh, swStartTime resets to now.
  const [swRunning, setSwRunning] = useState(wasRunning);
  const [swAccumulated, setSwAccumulated] = useState(restoredAccumulated);
  const [swStartTime, setSwStartTime] = useState<number | null>(wasRunning ? Date.now() : null);
  const [swCurrent, setSwCurrent] = useState(restoredAccumulated);
  const [swRecords, setSwRecords] = useState<StopwatchRecord[]>([]);

  // Keep a ref of live values for the unmount flush
  const liveRef = useRef({ swRunning: wasRunning, swAccumulated: restoredAccumulated, swStartTime: wasRunning ? Date.now() : null as number | null, swCurrent: restoredAccumulated });

  // Load Records on Init
  useEffect(() => {
    (window as any).electronAPI?.getStopwatchRecords().then((res: { success: boolean, data: StopwatchRecord[], error?: string }) => {
      if (res?.success && res.data) {
        setSwRecords(res.data);
      }
    });
  }, []);

  // Tick for Stopwatch
  useEffect(() => {
    const timer = setInterval(() => {
      if (swRunning && swStartTime) {
        setSwCurrent(swAccumulated + (Date.now() - swStartTime));
      } else {
        setSwCurrent(swAccumulated);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [swRunning, swStartTime, swAccumulated]);

  // Keep liveRef in sync so the unmount flush always has current values
  useEffect(() => {
    liveRef.current = { swRunning, swAccumulated, swStartTime, swCurrent };
  });

  // Flush current state to localStorage on unmount (logout/page change safety net)
  useEffect(() => {
    return () => {
      const { swRunning, swAccumulated, swStartTime, swCurrent } = liveRef.current;
      // Preserve running state — on next mount, the restore logic will
      // reconstruct elapsed time from swStartTime and resume the ticker.
      const finalAccumulated = swRunning && swStartTime
        ? swAccumulated + (Date.now() - swStartTime)
        : swAccumulated;
      // Keep swRunning: true so login restore knows to continue ticking
      persistSwState(swRunning, finalAccumulated, swRunning ? Date.now() : null);
    };
  }, []);

  const toggleStopwatch = () => {
    if (swRunning) {
      const paused = swCurrent;
      setSwAccumulated(paused);
      setSwStartTime(null);
      setSwRunning(false);
      // Write immediately — don't wait for the reactive effect
      persistSwState(false, paused, null);
    } else {
      const start = Date.now();
      setSwStartTime(start);
      setSwRunning(true);
      // Write immediately — this is the critical one that was getting lost
      persistSwState(true, swAccumulated, start);
    }
  };

  const resetStopwatch = () => {
    setSwRunning(false);
    setSwStartTime(null);
    setSwAccumulated(0);
    setSwCurrent(0);
    persistSwState(false, 0, null);
  };

  const formatStopwatch = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
  };

  const saveRecord = async () => {
    const newRecord: StopwatchRecord = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Record ${swRecords.length + 1}`,
      time: formatStopwatch(swCurrent),
      timestamp: Date.now()
    };
    const updated = [newRecord, ...swRecords].slice(0, 50);
    setSwRecords(updated);
    await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  const deleteRecord = async (id: string) => {
    const updated = swRecords.filter(r => r.id !== id);
    setSwRecords(updated);
    await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  const renameRecord = async (id: string, newName: string) => {
    const updated = swRecords.map(r => r.id === id ? { ...r, name: newName } : r);
    setSwRecords(updated);
    await (window as any).electronAPI?.saveStopwatchRecords(updated);
  };

  return {
    swRunning, swStartTime, swAccumulated, swCurrent, swRecords,
    toggleStopwatch, resetStopwatch, formatStopwatch,
    saveRecord, deleteRecord, renameRecord
  };
};
