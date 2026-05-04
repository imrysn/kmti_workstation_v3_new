import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './KMTISensei.css';
import { ttsApi } from '../services/api';

interface KMTISenseiProps {
  text: string;
  query?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  className?: string;
  autoSpeak?: boolean;
  disableKaraoke?: boolean;
  useNeural?: boolean;
}

/** Global cache for voices to avoid redundant getVoices calls in large tables */
let cachedVoices: SpeechSynthesisVoice[] = [];
const getGlobalVoices = () => {
  if (cachedVoices.length > 0) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
};

/**
 * KMTI Sensei: Browser Web Speech API TTS with karaoke-style sync.
 * Sanitizes formatting symbols, picks best available Japanese voice.
 */
export const KMTISensei: React.FC<KMTISenseiProps> = ({
  text,
  query = '',
  lang = 'en-US',
  rate = 1.2,
  pitch = 1.25,
  className = '',
  autoSpeak = false,
  disableKaraoke = false,
  useNeural = true
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [activeCharLength, setActiveCharLength] = useState(0);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveLang = useMemo(() => {
    // Robust detection: Hiragana, Katakana, CJK Ideographs, or Japanese-style punctuation/symbols
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF]/.test(text);
    return hasJapanese ? 'ja-JP' : lang;
  }, [text, lang]);

  // Load best available voice based on detected language
  useEffect(() => {
    const loadVoice = () => {
      const voices = getGlobalVoices();
      if (voices.length === 0) return;

      if (effectiveLang.startsWith('ja')) {
        const jaVoices = voices.filter(v => v.lang.includes('ja-JP') || v.lang.includes('ja_JP'));
        if (jaVoices.length > 0) {
          const best = jaVoices.find(v =>
            v.name.includes('Google') ||
            v.name.includes('Ichiro') ||
            v.name.includes('Sayaka') ||
            v.name.includes('Ayumi') ||
            v.name.includes('Haruka') ||
            v.name.includes('Kyoko')
          ) || jaVoices[0];
          voiceRef.current = best;
        }
      } else {
        const enVoices = voices.filter(v => v.lang.includes('en-US') || v.lang.includes('en_US') || v.lang.includes('en-GB'));
        if (enVoices.length > 0) {
          const best = enVoices.find(v =>
            v.name.includes('Google US English') ||
            v.name.includes('Microsoft Zira') ||
            v.name.includes('Samantha') ||
            v.name.includes('Female')
          ) || enVoices[0];
          voiceRef.current = best;
        }
      }
    };

    loadVoice();
    // Only attach listener if not already present or if we need to ensure update
    if (!window.speechSynthesis.onvoiceschanged) {
      window.speechSynthesis.onvoiceschanged = () => {
        cachedVoices = window.speechSynthesis.getVoices();
        loadVoice();
      };
    }

    // Cleanup synthesis and audio on unmount
    return () => {
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.onplay = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [effectiveLang]);

  const speak = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Stop any existing synthesis or audio
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    if (isSpeaking) {
      setIsSpeaking(false);
      setActiveCharIndex(-1);
      setActiveCharLength(0);
      return;
    }

    const spokenText = text.replace(/[*※]/g, ' ');

    if (useNeural) {
      // Use local Kokoro-82M TTS engine
      const voiceId = effectiveLang.startsWith('ja') ? 'jf_alpha' : 'af_heart';
      const url = ttsApi.getGenerateUrl(spokenText, voiceId, rate);

      setIsLoading(true);
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }

      audioRef.current.src = url;
      audioRef.current.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
        // Pseudo-karaoke: highlight whole text
        setActiveCharIndex(0);
        setActiveCharLength(text.length);
      };
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        setActiveCharIndex(-1);
        setActiveCharLength(0);
      };
      audioRef.current.onerror = (e) => {
        setIsLoading(false);
        const error = audioRef.current?.error;
        console.error(`[sensei] Neural TTS failed to load. URL: ${url}`, {
          code: error?.code,
          message: error?.message,
          event: e
        });

        // If we manually stopped the audio (src=""), don't trigger fallback
        if (!audioRef.current?.src || audioRef.current.src.endsWith('/') || audioRef.current.src === window.location.href) {
          return;
        }
        
        setIsSpeaking(false);
        // Fallback to local synthesis if network fails
        startLocalSynthesis(spokenText);
      };
      audioRef.current.play().catch(err => {
        setIsLoading(false);
        console.error(`[sensei] Playback promise rejected for URL: ${url}`, err);
        startLocalSynthesis(spokenText);
      });
    } else {
      startLocalSynthesis(spokenText);
    }
  }, [text, effectiveLang, rate, pitch, useNeural]);

  const startLocalSynthesis = (spokenText: string) => {
    const utterance = new SpeechSynthesisUtterance(spokenText);

    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.lang = effectiveLang;
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

    // Karaoke sync only available on local synthesis
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence') {
        setActiveCharIndex(event.charIndex);
        setActiveCharLength(event.charLength || 1);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Handle autoSpeak
  useEffect(() => {
    if (autoSpeak && text) {
      // Delay slightly to ensure UI has settled (important for some browsers)
      const timer = setTimeout(() => {
        speak();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [text, autoSpeak, speak]);

  // Render text with karaoke + search highlights
  const renderedContent = useMemo(() => {
    if (!text) return null;

    if (!isSpeaking && !query.trim()) {
      return <span>{text}</span>;
    }

    if (disableKaraoke && !query.trim()) {
      return <span>{text}</span>;
    }

    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = escapedQuery ? new RegExp(`(${escapedQuery})`, 'gi') : null;

    // Optimization: If not speaking and no search query, just render text
    // This drastically reduces DOM nodes in large tables
    if (!isSpeaking && !query.trim()) {
      return <span>{text}</span>;
    }

    return (
      <span className="sensei-text-container">
        {text.split('').map((char, index) => {
          const isKaraokeActive =
            isSpeaking &&
            index >= activeCharIndex &&
            index < activeCharIndex + activeCharLength;
          
          // For search highlights, we still want to wrap
          const isSearchMatch = searchRegex && char.match(searchRegex);
          
          if (!isKaraokeActive && !isSearchMatch) return char === ' ' ? '\u00A0' : char;

          return (
            <span
              key={index}
              className={`sensei-char ${isKaraokeActive ? 'karaoke-glow' : ''} ${isSearchMatch ? 'search-match' : ''}`}
            >
              {char === ' ' ? '\u00A0' : char}
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
        className={`sensei-audio-btn ${isSpeaking ? 'speaking' : ''} ${isLoading ? 'loading' : ''}`}
        onClick={speak}
        disabled={isLoading}
        title={isSpeaking ? 'Stop Listening' : (isLoading ? 'Generating...' : 'Listen')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {isLoading ? (
            <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10" fill="none">
              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </circle>
          ) : isSpeaking ? (
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
