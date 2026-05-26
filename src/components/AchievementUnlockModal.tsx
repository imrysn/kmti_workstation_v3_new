import { useEffect, useRef, useCallback } from 'react'
import { AchievementInfo } from './Achievement'
import './AchievementUnlockModal.css'

interface AchievementUnlockModalProps {
  achievement: AchievementInfo | null
  onClose: () => void
}

/** Plays a triumphant multi-layered fanfare using Web Audio API */
function playAchievementFanfare(rarity: 'common' | 'rare' | 'legendary') {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()

    const playNote = (freq: number, start: number, dur: number, vol = 0.06, type: OscillatorType = 'triangle') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur + 0.05)
    }

    if (rarity === 'legendary') {
      // Royal fanfare — ascending triumphal chord sequence
      playNote(392.0, 0.00, 0.15, 0.07, 'sine')  // G4
      playNote(523.3, 0.12, 0.15, 0.07, 'sine')  // C5
      playNote(659.3, 0.24, 0.15, 0.07, 'sine')  // E5
      playNote(783.9, 0.36, 0.30, 0.07, 'sine')  // G5
      playNote(1046.5, 0.55, 0.50, 0.06, 'sine') // C6
      // Harmony layer
      playNote(523.3, 0.36, 0.30, 0.04, 'triangle')
      playNote(659.3, 0.55, 0.50, 0.04, 'triangle')
    } else if (rarity === 'rare') {
      // Bright arpeggio burst
      playNote(523.3, 0.00, 0.12, 0.06)  // C5
      playNote(659.3, 0.08, 0.12, 0.06)  // E5
      playNote(783.9, 0.16, 0.12, 0.06)  // G5
      playNote(1046.5, 0.24, 0.30, 0.06) // C6
      playNote(783.9, 0.45, 0.20, 0.04)  // G5
    } else {
      // Common — simple two-note chime
      playNote(659.3, 0.00, 0.15, 0.06)
      playNote(1046.5, 0.15, 0.30, 0.06)
    }
  } catch (e) {
    console.warn('[ACHIEVEMENT] Fanfare failed:', e)
  }
}

export default function AchievementUnlockModal({ achievement, onClose }: AchievementUnlockModalProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClose = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!achievement) return

    // Play fanfare when modal opens
    playAchievementFanfare(achievement.rarity)

    // Auto-dismiss after 6 seconds
    timerRef.current = setTimeout(handleClose, 6000)

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      window.removeEventListener('keydown', onKey)
    }
  }, [achievement, handleClose])

  if (!achievement) return null

  const rarityLabel = {
    common: 'Achievement Unlocked',
    rare: 'Rare Achievement Unlocked',
    legendary: 'Legendary Achievement Unlocked',
  }[achievement.rarity]

  return (
    <div className={`achievement-modal-overlay rarity-${achievement.rarity}`} onClick={handleClose}>
      <div className="achievement-modal-card" onClick={(e) => e.stopPropagation()}>

        {/* Particle burst layer */}
        <div className="achievement-particles" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="achievement-particle" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>

        {/* Shine sweep */}
        <div className="achievement-shine" aria-hidden="true" />

        {/* Header label */}
        <div className="achievement-label-row">
          <div className="achievement-rarity-pill">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            {rarityLabel}
          </div>
        </div>

        {/* Icon */}
        <div className={`achievement-icon-wrap rarity-${achievement.rarity}`}>
          <div className="achievement-icon-inner">
            {achievement.icon}
          </div>
          <div className="achievement-icon-ring" />
        </div>

        {/* Title & description */}
        <div className="achievement-text">
          <h2 className="achievement-title">{achievement.title}</h2>
          <p className="achievement-desc">{achievement.description}</p>
        </div>

        {/* Footer */}
        <button className="achievement-dismiss-btn" onClick={handleClose}>
          Awesome!
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        {/* Auto-close progress bar */}
        <div className="achievement-progress-bar">
          <div className="achievement-progress-fill" />
        </div>
      </div>
    </div>
  )
}
