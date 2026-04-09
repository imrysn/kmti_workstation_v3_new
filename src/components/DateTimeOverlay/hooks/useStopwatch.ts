import { useState, useEffect } from 'react';
import { StopwatchRecord } from '../types';

export const useStopwatch = (initialSettings: any) => {
  const [swRunning, setSwRunning] = useState(initialSettings.swRunning || false);
  const [swAccumulated, setSwAccumulated] = useState(Number(initialSettings.swAccumulated) || 0);
  const [swStartTime, setSwStartTime] = useState<number | null>(Number(initialSettings.swStartTime) || null);
  const [swCurrent, setSwCurrent] = useState(Number(initialSettings.swAccumulated) || 0);
  const [swRecords, setSwRecords] = useState<StopwatchRecord[]>([]);

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

  const toggleStopwatch = () => {
    if (swRunning) {
      setSwAccumulated(swCurrent);
      setSwStartTime(null);
      setSwRunning(false);
    } else {
      setSwStartTime(Date.now());
      setSwRunning(true);
    }
  };

  const resetStopwatch = () => {
    setSwRunning(false);
    setSwStartTime(null);
    setSwAccumulated(0);
    setSwCurrent(0);
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
