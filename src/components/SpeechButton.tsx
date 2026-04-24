import React, { useState, useEffect } from 'react';
import './SpeechButton.css';

interface SpeechButtonProps {
  text: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  className?: string;
}

export const SpeechButton: React.FC<SpeechButtonProps> = ({
  text,
  lang = 'ja-JP',
  rate = 1.0,
  pitch = 1.0,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Try to find a high-quality Japanese voice
      const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang === 'ja_JP');
      if (jaVoice) setVoice(jaVoice);
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
  }, []);

  const speak = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Stop any current speech
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = pitch;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <button
      className={`kmti-speech-btn ${isSpeaking ? 'speaking' : ''} ${className}`}
      onClick={speak}
      title={isSpeaking ? "Stop Speaking" : "Listen to Pronunciation"}
      aria-label="Speak text"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {isSpeaking ? (
          <>
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </>
        ) : (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className="wave-1" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" className="wave-2" />
          </>
        )}
      </svg>
    </button>
  );
};
