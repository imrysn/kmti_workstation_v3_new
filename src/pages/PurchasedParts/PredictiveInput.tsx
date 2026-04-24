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
  const [focusedIndex, setFocusedIndex] = useState(-1);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0) {
        e.preventDefault();
        onSelect(suggestions[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const onSelect = (val: string) => {
    onChange(val);
    setShowSuggestions(false);
    setFocusedIndex(-1);
  };

  return (
    <div className="predictive-input-wrapper" ref={wrapperRef} onKeyDown={handleKeyDown} style={{ position: 'relative', width: '100%' }}>
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
                className={`predictive-suggestion-item ${i === focusedIndex ? 'active' : ''}`}
                onClick={() => onSelect(s)}
                onMouseEnter={() => setFocusedIndex(i)}
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
