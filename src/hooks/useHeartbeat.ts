import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { telemetryApi } from '../services/api';

export function useHeartbeat() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        const formData = new FormData();
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

        formData.append('module', module);
        formData.append('user_name', user.username);
        formData.append('version', '3.6.7'); // Fixed for now, could be dynamic

        await telemetryApi.heartbeat(formData);
      } catch (err) {
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
