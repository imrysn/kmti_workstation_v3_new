import React, { useState, useEffect, useMemo } from 'react';
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
 * KMTI Sensei: Browser Web Speech API TTS with karaoke-style sync.
 * Sanitizes formatting symbols, picks best available Japanese voice.
 */
export const KMTISensei: React.FC<KMTISenseiProps> = ({
  text,
  query = '',
  lang = 'ja-JP',
  rate = 1.2,
  pitch = 1.25,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [activeCharLength, setActiveCharLength] = useState(0);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Load best available Japanese voice
  useEffect(() => {
    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const jaVoices = voices.filter(v => v.lang.includes('ja-JP') || v.lang.includes('ja_JP'));
      if (jaVoices.length > 0) {
        const best = jaVoices.find(v =>
          v.name.includes('Google') ||
          v.name.includes('Ayumi') ||
          v.name.includes('Kyoko') ||
          v.name.includes('Haruka')
        ) || jaVoices[0];
        setVoice(best);
      }
    };
    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
  }, []);

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setActiveCharIndex(-1);
      setActiveCharLength(0);
      return;
    }

    // Strip formatting symbols — replace with space to preserve karaoke index alignment
    const spokenText = text.replace(/[*※]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(spokenText);

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
    // Karaoke sync: highlight the word currently being spoken
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence') {
        setActiveCharIndex(event.charIndex);
        setActiveCharLength(event.charLength || 1);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Render text with karaoke + search highlights
  const renderedContent = useMemo(() => {
    if (!text) return null;

    if (!isSpeaking && !query.trim()) {
      return <span>{text}</span>;
    }

    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = escapedQuery ? new RegExp(`(${escapedQuery})`, 'gi') : null;

    return (
      <span className="sensei-text-container">
        {text.split('').map((char, index) => {
          const isKaraokeActive =
            isSpeaking &&
            index >= activeCharIndex &&
            index < activeCharIndex + activeCharLength;
          const isSearchMatch = searchRegex && char.match(searchRegex);
          return (
            <span
              key={index}
              className={`sensei-char ${isKaraokeActive ? 'karaoke-glow' : ''} ${isSearchMatch ? 'search-match' : ''}`}
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  }, [text, query, isSpeaking, activeCharIndex, activeCharLength]);

  return (
    <div className={`kmti-sensei-cell ${isSpeaking ? 'active' : ''} ${className}`}>
      <div className="sensei-text-wrapper">
        {renderedContent}
      </div>

      <button
        className={`sensei-audio-btn ${isSpeaking ? 'speaking' : ''}`}
        onClick={speak}
        title={isSpeaking ? 'Stop Speaking' : 'Speak'}
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
