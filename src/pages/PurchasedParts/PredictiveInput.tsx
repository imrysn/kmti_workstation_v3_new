import React, { useState, useEffect, useRef } from 'react';
import { partsApi } from '../../services/api';
import { SearchIcon } from '../../components/FileIcons';

interface PredictiveInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  parentPath?: string;
}

export const PredictiveInput: React.FC<PredictiveInputProps> = ({ value, onChange, placeholder, parentPath }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await partsApi.getSuggestions(value, parentPath);
        setSuggestions(data);
        if (data.length > 0) setShowSuggestions(true);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [value, parentPath]);

  const onSelect = (val: string) => {
    onChange(val);
    setShowSuggestions(false);
  };

  return (
    <div className="predictive-input-wrapper" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div className="findr-search-icon"><SearchIcon size={18} /></div>
      <input
        className="findr-search-input"
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => value.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="predictive-suggestions-menu">
          {suggestions.map((s, i) => {
            // Case-insensitive highlighting
            const matchIndex = s.toLowerCase().indexOf(value.toLowerCase());
            const before = matchIndex >= 0 ? s.substring(0, matchIndex) : '';
            const match = matchIndex >= 0 ? s.substring(matchIndex, matchIndex + value.length) : '';
            const after = matchIndex >= 0 ? s.substring(matchIndex + value.length) : s;

            return (
              <div
                key={i}
                className="predictive-suggestion-item"
                onClick={() => onSelect(s)}
              >
                <div className="predictive-suggestion-text">
                  {before}<span className="match">{match}</span>{after}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
