import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { telemetryApi } from '../services/api';
import { version as appVersion } from '../../package.json';

export function useHeartbeat() {
  const location = useLocation();
  const { user } = useAuth();
  const computerNameRef = useRef<string | null>(null);

  // Fetch hostname once on mount via Electron IPC — cached in ref, not re-fetched every heartbeat
  useEffect(() => {
    if ((window as any).electronAPI?.getWorkstationInfo) {
      (window as any).electronAPI.getWorkstationInfo()
        .then((info: any) => { computerNameRef.current = info.computerName; })
        .catch(() => {
          let storedName = sessionStorage.getItem('kmti_dev_name')
          if (!storedName) {
            storedName = `Browser-User-${Math.floor(Math.random() * 1000)}`
            sessionStorage.setItem('kmti_dev_name', storedName)
          }
          computerNameRef.current = storedName
        });
    } else {
      // Dev mode browser fallback
      let storedName = sessionStorage.getItem('kmti_dev_name')
      if (!storedName) {
        storedName = `Browser-User-${Math.floor(Math.random() * 1000)}`
        sessionStorage.setItem('kmti_dev_name', storedName)
      }
      computerNameRef.current = storedName
    }
  }, []);

  // Play native cute Web Audio arpeggio chime sound (Triangle wave chiptune arpeggio)
  const playCuteChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // Soft retro chime tone
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.06, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      const now = ctx.currentTime;
      playNote(523.25, now, 0.12);        // C5
      playNote(659.25, now + 0.06, 0.12);  // E5
      playNote(783.99, now + 0.12, 0.12);  // G5
      playNote(1046.50, now + 0.18, 0.25); // C6
    } catch (e) {
      console.warn('[CHIME] Synthetic sound arpeggio failed:', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        // Map path to a friendly name
        const path = location.pathname;
        let module = 'Overview';
        if (path.includes('parts')) module = 'Findr';
        if (path.includes('characters')) module = 'Drafting Notes';
        if (path.includes('heat-treatment')) module = 'Special Process';
        if (path.includes('calculator')) module = 'Calculator';
        if (path.includes('quotation')) module = 'Quotation';
        if (path.includes('settings')) module = 'Settings';
        if (path.includes('admin-help')) module = 'Help Center';

        // Detect if app is minimized/hidden
        if (document.visibilityState === 'hidden') {
          module = `💤 ${module}`;
        }

        const formData = new FormData();
        formData.append('module', module);
        formData.append('user_name', user.displayName || user.fullName || user.username);
        formData.append('version', appVersion);
        if (computerNameRef.current) {
          formData.append('computer_name', computerNameRef.current);
        }

        const res = await telemetryApi.heartbeat(formData);
        
        // Handle nudge version check
        if (res.data && res.data.nudge_version) {
          const event = new CustomEvent('kmti:update-nudge', {
            detail: { version: res.data.nudge_version }
          });
          window.dispatchEvent(event);
        }

        // Handle incoming waves / pings
        if (res.data && Array.isArray(res.data.waves) && res.data.waves.length > 0) {
          playCuteChime();

          res.data.waves.forEach((sender: string) => {
            window.dispatchEvent(new CustomEvent('kmti:wave-received', {
              detail: { sender }
            }));
          });
        }
      } catch {
        // Silent fail for heartbeats
      }
    };

    // Send immediately on mount or path change
    sendHeartbeat();

    // Set up interval for every 60 seconds
    const interval = setInterval(sendHeartbeat, 60000);

    document.addEventListener('visibilitychange', sendHeartbeat);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', sendHeartbeat);
    };
  }, [location.pathname, user]);
}
