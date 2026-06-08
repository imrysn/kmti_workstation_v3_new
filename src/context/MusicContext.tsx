import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { SERVER_BASE } from '../services/api'
import { useAuth } from './AuthContext'

/**
 * Routes an external audio URL through the local backend proxy so Electron
 * can play it without hitting CSP / redirect / ICY-protocol issues.
 * localhost/blob/data URLs are returned unchanged.
 */
function toProxyUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.')) return url
  return `${SERVER_BASE}/api/music/proxy?url=${encodeURIComponent(url)}`
}

interface ListenerInfo {
  name: string
  isDj: boolean
  sid: string
}

interface RoomState {
  id: string
  displayName: string
  djSid: string
  djName: string
  trackUrl: string
  trackTitle: string
  isPlaying: boolean
  currentTime: number
  lastUpdated: number
  listeners: Record<string, ListenerInfo>
}

interface MusicContextType {
  isConnected: boolean
  activeRoom: RoomState | null
  isDj: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  trackUrl: string
  trackTitle: string
  listeners: ListenerInfo[]
  rooms: any[]
  fetchRooms: () => Promise<void>
  createRoom: (roomName: string) => void
  joinRoom: (roomId: string) => void
  leaveRoom: () => void
  changeTrack: (url: string, title: string) => void
  togglePlay: () => void
  seek: (seconds: number) => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  /** Exposes the internal HTMLAudioElement so components can hook a Web Audio AnalyserNode */
  getAudioElement: () => HTMLAudioElement | null
}

const MusicContext = createContext<MusicContextType | undefined>(undefined)

export const useMusic = () => {
  const context = useContext(MusicContext)
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider')
  }
  return context
}

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  const [isConnected, setIsConnected] = useState(false)
  const [rooms, setRooms] = useState<any[]>([])
  const [activeRoom, setActiveRoom] = useState<RoomState | null>(null)
  const [isDj, setIsDj] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [isMuted, setIsMuted] = useState(false)
  const [trackUrl, setTrackUrl] = useState('')
  const [trackTitle, setTrackTitle] = useState('')
  const [listeners, setListeners] = useState<ListenerInfo[]>([])
  
  // A ref to avoid stale state in event handlers
  const stateRef = useRef({
    isDj: false,
    trackUrl: '',
    isPlaying: false,
    currentTime: 0,
    activeRoomId: '' as string | null
  })

  useEffect(() => {
    stateRef.current = {
      isDj,
      trackUrl,
      isPlaying,
      currentTime,
      activeRoomId: activeRoom?.id || null
    }
  }, [isDj, trackUrl, isPlaying, currentTime, activeRoom])

  // Initialize HTML5 Audio element
  useEffect(() => {
    const audio = new Audio()
    audio.volume = volume
    audioRef.current = audio

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
      // If we are DJ, periodically update the server with the playhead time
      const socket = socketRef.current
      const activeId = stateRef.current.activeRoomId
      if (socket && stateRef.current.isDj && activeId && audio.paused === false) {
        // Debounce or send periodic sync on timeupdate (say, every 2-3 seconds)
        // Standard HTML5 audio triggers timeupdate multiple times a second.
        // Let's only emit if we've moved significantly or if we have a simple throttle.
        const lastEmitTime = (audio as any).lastEmitTime || 0
        const now = Date.now()
        if (now - lastEmitTime > 2500) {
          (audio as any).lastEmitTime = now
          socket.emit('dj_state_change', {
            room_id: activeId,
            isPlaying: true,
            currentTime: audio.currentTime,
            trackUrl: stateRef.current.trackUrl,
            trackTitle: audio.title || stateRef.current.trackUrl
          })
        }
      }
    }

    const onDurationChange = () => {
      setDuration(audio.duration || 0)
    }

    const onPlay = () => {
      setIsPlaying(true)
    }

    const onPause = () => {
      setIsPlaying(false)
    }

    const onError = (e: any) => {
      const mediaErr = (e.target as HTMLAudioElement)?.error
      const code = mediaErr?.code
      const codeNames: Record<number, string> = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
      }
      console.error(
        `[MusicPlayer] Playback error — code ${code} (${codeNames[code ?? 0] ?? 'UNKNOWN'}):`,
        mediaErr?.message || 'No message'
      )
      setIsPlaying(false)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
    }
  }, [volume])

  // Fetch rooms list from HTTP API
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_BASE}/api/music/rooms`)
      const data = await res.json()
      if (data.success) {
        setRooms(data.rooms)
      }
    } catch (e) {
      console.error('[MusicContext] Failed to fetch rooms:', e)
    }
  }, [])

  // Initialize Socket connection
  useEffect(() => {
    if (!user) {
      // Clean up socket on logout
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setIsConnected(false)
      setActiveRoom(null)
      return
    }

    if (!socketRef.current) {
      socketRef.current = io(SERVER_BASE, {
        path: '/socket.io',
        transports: ['polling', 'websocket'],
        reconnectionDelay: 2000,
        timeout: 10000,
      })
    }

    const socket = socketRef.current

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('[MusicSocket] Connected:', socket.id)
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      setActiveRoom(null)
      setIsDj(false)
    })

    socket.on('music_room_created', (data: { roomId: string; room: RoomState }) => {
      setActiveRoom(data.room)
      setIsDj(data.room.djSid === socket.id)
      setListeners(Object.values(data.room.listeners))
      setTrackUrl(data.room.trackUrl)
      setTrackTitle(data.room.trackTitle)
    })

    socket.on('music_room_joined', (data: { roomId: string; room: RoomState }) => {
      setActiveRoom(data.room)
      setIsDj(data.room.djSid === socket.id)
      setListeners(Object.values(data.room.listeners))
      setTrackUrl(data.room.trackUrl)
      setTrackTitle(data.room.trackTitle)

      const audio = audioRef.current
      if (audio && data.room.trackUrl) {
        const proxied = toProxyUrl(data.room.trackUrl)
        if (audio.src !== proxied) {
          audio.src = proxied
          audio.title = data.room.trackTitle
        }
        
        // Sync time and play
        if (data.room.isPlaying) {
          audio.currentTime = data.room.currentTime + (Date.now() / 1000 - data.room.lastUpdated)
          audio.play().catch(() => {
            console.log('[MusicPlayer] Autoplay blocked or failed. Waiting for user interaction.')
          })
        } else {
          audio.pause()
        }
      }
    })

    socket.on('music_listeners_updated', (data: { roomId: string; listeners: ListenerInfo[] }) => {
      setListeners(data.listeners)
      // Check if DJ has changed
      const currentDj = data.listeners.find(l => l.isDj)
      if (currentDj) {
        setIsDj(currentDj.sid === socket.id)
        setActiveRoom(prev => prev ? { ...prev, djName: currentDj.name, djSid: currentDj.sid } : null)
      }
    })

    socket.on('music_state_update', (data: {
      roomId: string
      djName: string
      isPlaying: boolean
      currentTime: number
      trackUrl: string
      trackTitle: string
    }) => {
      // Only process state updates from DJ if I am NOT the DJ
      if (stateRef.current.isDj) return

      setActiveRoom(prev => prev ? { ...prev, djName: data.djName } : null)
      setTrackUrl(data.trackUrl)
      setTrackTitle(data.trackTitle)

      const audio = audioRef.current
      if (!audio) return

      // Handle URL change
      if (data.trackUrl) {
        const proxied = toProxyUrl(data.trackUrl)
        if (audio.src !== proxied) {
          audio.src = proxied
          audio.title = data.trackTitle
        }

        // Handle Play/Pause
        if (data.isPlaying) {
          // Sync playback time
          const delta = Math.abs(audio.currentTime - data.currentTime)
          if (delta > 2.5) {
            audio.currentTime = data.currentTime
          }
          audio.play().catch(() => {})
        } else {
          audio.pause()
          const delta = Math.abs(audio.currentTime - data.currentTime)
          if (delta > 1.0) {
            audio.currentTime = data.currentTime
          }
        }
      } else {
        // No track playing
        audio.pause()
        audio.src = ''
        setTrackUrl('')
        setTrackTitle('')
      }
    })

    socket.on('music_error', (data: { message: string }) => {
      alert(`[Music Room Error] ${data.message}`)
    })

    // Fetch initial active rooms list
    fetchRooms()

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('music_room_created')
      socket.off('music_room_joined')
      socket.off('music_listeners_updated')
      socket.off('music_state_update')
      socket.off('music_error')
    }
  }, [user, fetchRooms])

  // --- Actions ---

  const createRoom = useCallback((roomName: string) => {
    const socket = socketRef.current
    if (socket && isConnected && user) {
      socket.emit('create_music_room', {
        room_name: roomName,
        username: user.displayName ?? user.username
      })
    }
  }, [isConnected, user])

  const joinRoom = useCallback((roomId: string) => {
    const socket = socketRef.current
    if (socket && isConnected && user) {
      socket.emit('join_music_room', {
        room_id: roomId,
        username: user.displayName ?? user.username
      })
    }
  }, [isConnected, user])

  const leaveRoom = useCallback(() => {
    const socket = socketRef.current
    const roomId = stateRef.current.activeRoomId
    if (socket && isConnected && roomId) {
      socket.emit('leave_music_room', { room_id: roomId })
      setActiveRoom(null)
      setIsDj(false)
      setListeners([])
      setTrackUrl('')
      setTrackTitle('')
      
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.src = ''
      }
    }
  }, [isConnected])

  const changeTrack = useCallback((url: string, title: string) => {
    const socket = socketRef.current
    const roomId = stateRef.current.activeRoomId
    if (socket && isConnected && stateRef.current.isDj && roomId) {
      setTrackUrl(url)
      setTrackTitle(title)
      
      const audio = audioRef.current
      if (audio) {
        const proxied = toProxyUrl(url)
        audio.src = proxied
        audio.title = title
        audio.play().catch(() => {})
        
        socket.emit('dj_state_change', {
          room_id: roomId,
          isPlaying: true,
          currentTime: 0,
          trackUrl: url,
          trackTitle: title
        })
      }
    }
  }, [isConnected])

  const togglePlay = useCallback(() => {
    const socket = socketRef.current
    const roomId = stateRef.current.activeRoomId
    const audio = audioRef.current
    if (audio && roomId) {
      if (stateRef.current.isDj) {
        const nextPlaying = !audio.paused
        if (audio.paused) {
          audio.play().catch(() => {})
        } else {
          audio.pause()
        }
        
        if (socket && isConnected) {
          socket.emit('dj_state_change', {
            room_id: roomId,
            isPlaying: !nextPlaying,
            currentTime: audio.currentTime,
            trackUrl: stateRef.current.trackUrl,
            trackTitle: stateRef.current.trackUrl
          })
        }
      } else {
        // Listener toggle: locally play/pause (override or mute)
        if (audio.paused) {
          audio.play().catch(() => {})
        } else {
          audio.pause()
        }
      }
    }
  }, [isConnected])

  const seek = useCallback((seconds: number) => {
    const socket = socketRef.current
    const roomId = stateRef.current.activeRoomId
    const audio = audioRef.current
    if (audio && roomId && stateRef.current.isDj) {
      audio.currentTime = seconds
      if (socket && isConnected) {
        socket.emit('dj_state_change', {
          room_id: roomId,
          isPlaying: !audio.paused,
          currentTime: seconds,
          trackUrl: stateRef.current.trackUrl,
          trackTitle: stateRef.current.trackUrl
        })
      }
    }
  }, [isConnected])

  const setVolume = useCallback((vol: number) => {
    const normalized = Math.max(0, Math.min(1, vol))
    setVolumeState(normalized)
    if (audioRef.current) {
      audioRef.current.volume = normalized
      audioRef.current.muted = isMuted
    }
  }, [isMuted])

  const toggleMute = useCallback(() => {
    const nextMute = !isMuted
    setIsMuted(nextMute)
    if (audioRef.current) {
      audioRef.current.muted = nextMute
    }
  }, [isMuted])

  const getAudioElement = useCallback((): HTMLAudioElement | null => {
    return audioRef.current
  }, [])

  return (
    <MusicContext.Provider value={{
      isConnected,
      activeRoom,
      isDj,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      trackUrl,
      trackTitle,
      listeners,
      rooms,
      fetchRooms,
      createRoom,
      joinRoom,
      leaveRoom,
      changeTrack,
      togglePlay,
      seek,
      setVolume,
      toggleMute,
      getAudioElement
    }}>
      {children}
    </MusicContext.Provider>
  )
}
