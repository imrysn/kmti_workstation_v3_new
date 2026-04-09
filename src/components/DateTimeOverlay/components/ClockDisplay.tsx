import React, { useState, useEffect } from 'react';

interface ClockDisplayProps {
  accentColor: string;
}

export const ClockDisplay: React.FC<ClockDisplayProps> = ({ accentColor }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <span className="findr-datetime-time" style={{ color: accentColor }}>{timeStr}</span>
      <div className="findr-datetime-separator" style={{ backgroundColor: accentColor, opacity: 0.3 }} />
      <span className="findr-datetime-date" style={{ color: accentColor, opacity: 0.8 }}>{dateStr}</span>
    </>
  );
};
