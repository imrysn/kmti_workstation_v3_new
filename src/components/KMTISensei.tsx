import React, { useState, useEffect, useMemo, useRef } from 'react';
import './KMTISensei.css';

interface KMTISenseiProps {
  text: string;
  query?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  className?: string;
}

/**
 * KMTI Sensei: A high-fidelity language learning component for CAD engineers.
 * Handles search highlighting AND real-time karaoke-style TTS synchronization.
 */
export const KMTISensei: React.FC<KMTISenseiProps> = ({
  text,
  query = '',
  lang = 'ja-JP',
  rate = 0.9,
  pitch = 1.0,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [activeCharLength, setActiveCharLength] = useState(0);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Find ja-JP voice on mount
  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(v => v.lang.includes('ja-JP') || v.lang.includes('ja_JP'));
      if (jaVoice) setVoice(jaVoice);
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setActiveCharIndex(-1);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveCharIndex(-1);
      setActiveCharLength(0);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveCharIndex(-1);
      setActiveCharLength(0);
    };

    // THE KARAOKE BRIDGE: Track character boundaries using engine-reported length
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence') {
        setActiveCharIndex(event.charIndex);
        setActiveCharLength(event.charLength || 1); // Default to 1 if engine doesn't report length
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Logic to render text with BOTH search highlights and karaoke highlights
  const renderedContent = useMemo(() => {
    if (!text) return null;

    // 1. If not speaking and no search query, just return text
    if (!isSpeaking && !query.trim()) {
      return <span>{text}</span>;
    }

    // 2. Prepare segments for search highlighting
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = escapedQuery ? new RegExp(`(${escapedQuery})`, 'gi') : null;

    return (
      <span className="sensei-text-container">
        {text.split('').map((char, index) => {
          // THE PRECISION SYNC: Highlight exactly what the engine reports
          const isKaraokeActive = isSpeaking && index >= activeCharIndex && index < activeCharIndex + activeCharLength;

          // Is this character part of the search query?
          // (Simplified search check for individual chars)
          const isSearchMatch = searchRegex && char.match(searchRegex);

          return (
            <span
              key={index}
              className={`sensei-char 
                ${isKaraokeActive ? 'karaoke-glow' : ''} 
                ${isSearchMatch ? 'search-match' : ''}
              `}
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  }, [text, query, isSpeaking, activeCharIndex]);

  return (
    <div className={`kmti-sensei-cell ${isSpeaking ? 'active' : ''} ${className}`}>
      <div className="sensei-text-wrapper">
        {renderedContent}
      </div>

      <button
        className={`sensei-audio-btn ${isSpeaking ? 'speaking' : ''}`}
        onClick={speak}
        title={isSpeaking ? "Stop Speaking" : "Speak"}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {isSpeaking ? (
            <path d="M6 4h4v16H6zm8 0h4v16h-4z" fill="currentColor" stroke="none" />
          ) : (
            <>
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
};
