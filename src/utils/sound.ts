/**
 * Shared Web Audio Context Singleton
 * Prevents exhausting browser AudioContext instances (which causes audio failure / console errors).
 */

let sharedAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioContextClass();
    }

    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }

    return sharedAudioCtx;
  } catch (e) {
    console.warn('[Sound] AudioContext unavailable:', e);
    return null;
  }
}

/**
 * Synthesizes a subtle, pleasant mechanical typing tick.
 */
export function playTypingSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(100 + Math.random() * 50, ctx.currentTime);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800 + Math.random() * 200, ctx.currentTime);

    gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();

    osc1.stop(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Graceful fallback for environments with disabled sound
  }
}

/**
 * Incoming message notification chime (E5 -> A5 ascending bell tone).
 */
export function playMessageChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(659.25, now, 0.08); // E5
    playNote(880.00, now + 0.06, 0.15); // A5
  } catch (e) {
    // Graceful fallback
  }
}

/**
 * Easter egg discovery chime (C5 -> E5 -> G5 -> C6 fanfare).
 */
export function playEasterEggChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.05, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(523.25, now, 0.1);
    playNote(659.25, now + 0.05, 0.1);
    playNote(783.99, now + 0.1, 0.1);
    playNote(1046.50, now + 0.15, 0.3);
  } catch (e) {
    // Graceful fallback
  }
}
