import React, { useState, useEffect, useCallback } from 'react'
import { broadcastApi } from '../services/api'
import megaphoneIcon from '../assets/megaphone-icon.png'
import './BroadcastOverlay.css'

export interface Broadcast {
  id: number
  message: string
  severity: 'info' | 'warning' | 'danger'
  created_by: string
  created_at: string
}

const BroadcastOverlay: React.FC = () => {
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null)
  const [islandMode, setIslandMode] = useState<'hidden' | 'collapsed' | 'expanded'>('hidden')

  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await broadcastApi.getActive()
      const data = res.data.data
      
      if (!data) {
        setIslandMode('hidden')
        setActiveBroadcast(null)
        return
      }

      // Check if we've already seen this specific broadcast
      const seenRaw = localStorage.getItem('kmti_seen_broadcasts')
      const seenIds: number[] = seenRaw ? JSON.parse(seenRaw) : []
      
      if (seenIds.includes(data.id)) {
        // We've already shown this one for 15s this session/ever
        if (islandMode !== 'hidden') setIslandMode('hidden')
        return
      }

      // New broadcast detected!
      setActiveBroadcast(data)
      setIslandMode('expanded')

      // Start the 15-second timer to auto-hide
      setTimeout(() => {
        setIslandMode('hidden')
        // Mark as seen so it doesn't pop up again
        const updatedSeen = [...new Set([...seenIds, data.id])]
        localStorage.setItem('kmti_seen_broadcasts', JSON.stringify(updatedSeen))
      }, 15000)

    } catch (err) {
      console.error('Failed to fetch active broadcast:', err)
    }
  }, [islandMode])

  useEffect(() => {
    fetchBroadcast()
    // Rapid poll (10s) so messages are caught quickly
    const interval = setInterval(fetchBroadcast, 10000)
    return () => clearInterval(interval)
  }, [fetchBroadcast])

  if (!activeBroadcast || islandMode === 'hidden') return null

  return (
    <div 
      className={`dynamic-island severity-${activeBroadcast.severity} ${islandMode}`}
      onMouseEnter={() => islandMode === 'collapsed' && setIslandMode('expanded')}
    >
      <div className="island-content">
        <div className="island-header">
          <div className="island-icon-box">
             <div className={`island-dot dot-${activeBroadcast.severity}`} />
             <img src={megaphoneIcon} alt="!" className="island-icon-img" />
          </div>
          <div className="island-meta">
            <span className="island-tag">SYSTEM BROADCAST</span>
            <span className="island-author">via {activeBroadcast.created_by}</span>
          </div>
        </div>
        
        <div className="island-body">
          <p className="island-message">{activeBroadcast.message}</p>
        </div>
      </div>
      
      <div className="island-timer-bar">
        <div className="island-timer-progress"></div>
      </div>
    </div>
  )
}

export default BroadcastOverlay
