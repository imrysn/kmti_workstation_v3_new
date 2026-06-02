import React, { useState, useEffect, useCallback, useRef } from 'react'
import { broadcastApi, ttsApi } from '../services/api'
import megaphoneIcon from '../assets/megaphone-icon.png'
import { useAuth } from '../context/AuthContext'
import { getDisplayName } from '../utils/nameUtils'
import './BroadcastOverlay.css'

interface Broadcast {
  id: number
  message: string
  severity: 'info' | 'warning' | 'danger'
  created_by: string
  created_at: string
}

interface AckNotification {
  id: string
  workstation: string
  username: string
  fullName: string
  displayName: string | null
  time: string
}

const BroadcastOverlay: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [recentAcks, setRecentAcks] = useState<AckNotification[]>([])
  const [exitingId, setExitingId] = useState<number | null>(null)
  const lastAlertedId = useRef<number | null>(null)

  const speakBroadcast = (message: string, severity: string) => {
    // Prefix based on severity for immediate context
    let prefix = 'Attention: '
    if (severity === 'danger') prefix = 'Attention: Urgent Announcement. '
    if (severity === 'warning') prefix = 'System Alert. '
    const fullText = prefix + message

    // 1. Try Kokoro-82M (High-Quality AI Voice)
    try {
      const url = ttsApi.getGenerateUrl(fullText, 'af_heart')
      const audio = new Audio(url)
      
      // If we are already speaking natively, cancel it
      if (window.speechSynthesis) window.speechSynthesis.cancel()
      
      audio.play().catch(() => {
        // Fallback to native if Kokoro server fails
        speakNatively(fullText, severity)
      })
    } catch (e) {
      speakNatively(fullText, severity)
    }
  }

  const speakNatively = (fullText: string, severity: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(fullText)
    
    // Pitch/Rate adjustments for urgency
    if (severity === 'danger') {
      utterance.pitch = 1.2
      utterance.rate = 1.1
      utterance.volume = 1.0
    } else {
      utterance.pitch = 1.0
      utterance.rate = 1.0
      utterance.volume = 0.8
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      const preferred = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Premium')) && 
        v.lang.startsWith('en')
      )
      if (preferred) utterance.voice = preferred
    }

    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  const playAckAlert = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const now = ctx.currentTime
      const playChirp = (time: number, freq: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(freq, time)
        gain.gain.setValueAtTime(0.08, time)
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1)
        osc.start(time)
        osc.stop(time + 0.1)
      }
      playChirp(now, 880)
      playChirp(now + 0.12, 1100)
    } catch (e) {}
  }

  const playAlert = (severity: string) => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      
      if (severity === 'danger') {
        osc.frequency.setValueAtTime(880, now)
        gain.gain.setValueAtTime(0.2, now)
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.5)
      } else if (severity === 'warning') {
        osc.frequency.setValueAtTime(660, now)
        gain.gain.setValueAtTime(0.15, now)
      } else {
        osc.frequency.setValueAtTime(523, now)
        gain.gain.setValueAtTime(0.1, now)
      }
      
      osc.start()
      osc.stop(now + 0.5)
    } catch (e) {}
  }

  const triggerFlash = () => {
    if (window.electronAPI?.flashWindow) window.electronAPI.flashWindow(true)
  }

  const stopFlash = () => {
    if (window.electronAPI?.flashWindow) window.electronAPI.flashWindow(false)
  }

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await broadcastApi.getActive()
      const data = res.data.data
      
      if (!data) {
        setBroadcasts([])
        return
      }

      // Respect dismissed broadcasts (robust ID checking)
      const seenRaw = localStorage.getItem('kmti_seen_broadcasts')
      const seenIds: number[] = seenRaw ? JSON.parse(seenRaw).map(Number) : []
      const currentId = Number(data.id)

      if (seenIds.includes(currentId)) {
        setBroadcasts([])
        return
      }

      // Handle arrival alerts - ensure we don't flash/play for already seen/handled items
      if (currentId !== lastAlertedId.current) {
        lastAlertedId.current = currentId
        playAlert(data.severity)
        triggerFlash()
        
        // Native High-Fidelity TTS
        speakBroadcast(data.message, data.severity)
      }

      setBroadcasts([data]) 
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err)
    }
  }, [])

  const { hasRole } = useAuth()

  useEffect(() => {
    fetchBroadcasts()
    const interval = setInterval(fetchBroadcasts, 8000)
    
    // Listen for real-time ack events dispatched by BroadcastFAB's socket (admin/IT only)
    // This avoids opening a second duplicate socket connection from this component
    const handleBroadcastUpdate = (e: Event) => {
      if (!hasRole('admin', 'it')) return
      const data = (e as CustomEvent).detail
      const newAck: AckNotification = {
        id: Math.random().toString(36).substr(2, 9),
        workstation: data.workstation,
        username: data.username,
        fullName: data.fullName || data.username,
        displayName: data.displayName || null,
        time: data.time
      }
      setRecentAcks(prev => [newAck, ...prev].slice(0, 3))
      playAckAlert()
      setTimeout(() => {
        setRecentAcks(prev => prev.filter(a => a.id !== newAck.id))
      }, 6000)
    }

    window.addEventListener('kmti:broadcast-update', handleBroadcastUpdate)
    
    // --- DEBUG: Local UI Testing Hook ---
    const handleTestBroadcast = (e: Event) => {
      const mockData = (e as CustomEvent).detail
      setBroadcasts([mockData])
    }
    window.addEventListener('kmti:test-broadcast', handleTestBroadcast)

    return () => {
      clearInterval(interval)
      window.removeEventListener('kmti:broadcast-update', handleBroadcastUpdate)
      window.removeEventListener('kmti:test-broadcast', handleTestBroadcast)
    }
  }, [fetchBroadcasts, hasRole])

  const handleAcknowledge = async (id: number) => {
    setExitingId(id)
    stopFlash()
    
    // Send persistent ack to backend
    try {
      let workstation = 'Browser/Unknown'
      if (window.electronAPI?.getWorkstationInfo) {
        const info = await window.electronAPI.getWorkstationInfo()
        workstation = info.computerName || info.username || 'Electron-Workstation'
      }
      await broadcastApi.acknowledge(id, workstation)
    } catch (e) {
      console.warn("Server ack failed (background)", e)
    }

    // Animation timeout then remove locally
    setTimeout(() => {
      const seenRaw = localStorage.getItem('kmti_seen_broadcasts')
      const seenIds: number[] = seenRaw ? JSON.parse(seenRaw).map(Number) : []
      
      // Add current ID, remove duplicates, and keep only the latest 100 entries
      const updatedSeen = [...new Set([...seenIds, Number(id)])].slice(-100)
      
      localStorage.setItem('kmti_seen_broadcasts', JSON.stringify(updatedSeen))
      setBroadcasts(prev => prev.filter(b => b.id !== id))
      setExitingId(null)
    }, 600)
  }

  return (
    <div className="broadcast-overlay-container">
      {/* Real-time Ack Pills */}
      <div className="ack-pills-container">
        {recentAcks.map(ack => (
          <div key={ack.id} className="ack-pill">
            <div className="ack-pill-icon">✓</div>
            <div className="ack-pill-content">
              <strong>{ack.displayName || getDisplayName(ack.fullName) || ack.workstation}</strong> acknowledged
              <span>{ack.time}</span>
            </div>
          </div>
        ))}
      </div>

      {broadcasts.map((b, idx) => (
        <div 
          key={b.id}
          className={`dynamic-island severity-${b.severity} ${exitingId === b.id ? 'is-exiting' : 'expanded'}`}
          style={{ zIndex: 10002 - idx, transform: `translateX(-50%) translateY(${idx * 15}px) scale(${1 - idx * 0.05})` }}
        >
          <button className="island-close-btn" onClick={() => handleAcknowledge(b.id)}>×</button>
          
          <div className="island-content">
            <div className="island-header">
              <div className="island-icon-box">
                 <div className={`island-dot dot-${b.severity}`} />
                 <div className="island-icon-img" style={{ WebkitMaskImage: `url(${megaphoneIcon})`, maskImage: `url(${megaphoneIcon})` }} />
              </div>
              <div className="island-meta">
                <span className="island-tag">
                  {b.severity === 'danger' ? 'URGENT ANNOUNCEMENT' : b.severity === 'warning' ? 'SYSTEM ALERT' : 'GENERAL ANNOUNCEMENT'}
                </span>
              </div>
            </div>
            
            <div className="island-body">
              <p className="island-message">{b.message}</p>
            </div>

            <div className="island-actions">
               <button className="island-ack-btn" onClick={() => handleAcknowledge(b.id)}>
                 OK, I UNDERSTAND
               </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default BroadcastOverlay
