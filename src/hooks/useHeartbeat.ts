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
    window.electronAPI.getWorkstationInfo()
      .then(info => { computerNameRef.current = info.computerName; })
      .catch(() => {});
  }, []);

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
        if (path.includes('admin-help')) module = 'IT Admin';

        const formData = new FormData();
        formData.append('module', module);
        formData.append('user_name', user.username);
        formData.append('version', appVersion);
        if (computerNameRef.current) {
          formData.append('computer_name', computerNameRef.current);
        }

        await telemetryApi.heartbeat(formData);
      } catch {
        // Silent fail for heartbeats
      }
    };

    // Send immediately on mount or path change
    sendHeartbeat();

    // Set up interval for every 60 seconds
    const interval = setInterval(sendHeartbeat, 60000);

    return () => clearInterval(interval);
  }, [location.pathname, user]);
}
