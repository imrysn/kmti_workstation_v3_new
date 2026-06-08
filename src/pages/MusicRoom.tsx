import React, { useState, useEffect } from 'react'
import { useMusic } from '../context/MusicContext'
import AudioVisualizer from '../components/AudioVisualizer'
import './MusicRoom.css'

const PRESET_STREAMS = [
  // --- Philippine FM Radio ---
  {
    title: '🇵🇭 Barangay LS 97.1',
    url: 'http://28093.live.streamtheworld.com:3690/MORFM_S01AAC_SC',
    desc: 'GMA Network — OPM, Top 40, Love Songs'
  },
  {
    title: '🇵🇭 Easy Rock 96.3 Manila',
    url: 'https://azura.easyrock.com.ph/listen/easy_rock_manila/radio.mp3',
    desc: 'Soft rock and easy listening hits'
  },
  {
    title: '🇵🇭 Love Radio Manila 90.7',
    url: 'https://azura.loveradio.com.ph/listen/love_radio_manila/radio.mp3',
    desc: 'OPM love songs 24/7'
  },
  {
    title: '🇵🇭 Yes FM 101.1 Manila',
    url: 'https://azura.yesfm.com.ph/listen/yes_fm_manila/radio.mp3',
    desc: 'The Best — OPM and Top 40'
  },
  {
    title: '🇵🇭 MOR 101.9 Manila',
    url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/MORFM_S01.mp3',
    desc: 'Music of your Radio — OPM hits'
  },
  {
    title: '🇵🇭 Star FM Manila 102.7',
    url: 'https://stream-13.zeno.fm/g1pmt17nz9duv',
    desc: 'Bombo Radyo Star FM'
  },
  {
    title: '🇵🇭 Mellow 94.7 BFM',
    url: 'https://streamer.radio.co/sec36cd5f1/listen',
    desc: 'Soft adult contemporary — Manila'
  },
  // --- Ambient / International ---
  {
    title: '🎵 Lofi Girl Radio',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    desc: 'Chill beats to relax/study to (24/7)'
  },
  {
    title: '🎵 Groove Salad (SomaFM)',
    url: 'https://ice1.somafm.com/groovesalad-256-mp3',
    desc: 'Ambient/downtempo beats for deep work'
  },
  {
    title: '🎵 Drone Zone (SomaFM)',
    url: 'https://ice1.somafm.com/dronezone-256-mp3',
    desc: 'Atmospheric ambient space music'
  },
]

export default function MusicRoom() {
  const {
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
    toggleMute
  } = useMusic()

  const [newRoomName, setNewRoomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [urlError, setUrlError] = useState('')

  // Poll active rooms list on load or lobby mode
  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 8000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (newRoomName.trim()) {
      createRoom(newRoomName.trim())
      setNewRoomName('')
    }
  }

  const handlePlayPreset = (preset: typeof PRESET_STREAMS[0]) => {
    changeTrack(preset.url, preset.title)
  }

  const BLOCKED_HOSTS = [
    'youtube.com', 'youtu.be', 'music.youtube.com',
    'spotify.com', 'open.spotify.com',
    'soundcloud.com',
    'music.apple.com', 'itunes.apple.com',
    'tidal.com', 'deezer.com', 'pandora.com',
    'amazon.com/music', 'music.amazon.com',
  ]

  const validateStreamUrl = (url: string): string => {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.replace(/^www\./, '')
      const blocked = BLOCKED_HOSTS.find(b => host === b || host.endsWith('.' + b))
      if (blocked) {
        return `${blocked} is not a direct audio stream. YouTube, Spotify, and similar platforms require their own app — they don't expose raw audio URLs. Use a direct .mp3 or radio stream URL instead.`
      }
      // Warn about .m3u8 (HLS) — Electron may not support it without extra flags
      if (parsed.pathname.endsWith('.m3u8')) {
        return 'HLS (.m3u8) streams may not play in this app. Try an .mp3 or .aac direct stream URL.'
      }
    } catch {
      return 'Invalid URL. Please enter a full URL starting with http:// or https://.'
    }
    return ''
  }

  const handlePlayCustom = (e: React.FormEvent) => {
    e.preventDefault()
    const url = customUrl.trim()
    if (!url) return
    const err = validateStreamUrl(url)
    if (err) {
      setUrlError(err)
      return
    }
    setUrlError('')
    const title = customTitle.trim() || 'Custom Stream'
    changeTrack(url, title)
    setCustomUrl('')
    setCustomTitle('')
  }

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) return '0:00'
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  // Lobby view: User is not inside any room
  if (!activeRoom) {
    return (
      <div className="music-page">
        <div className="music-scanlines" aria-hidden="true" />
        
        <header className="music-header">
          <div className="music-terminal-bar">
            <span className="music-dot music-dot--red" />
            <span className="music-dot music-dot--yellow" />
            <span className="music-dot music-dot--green" />
            <span className="music-terminal-title">kmti_workstation // synchronized_audio_lobby</span>
          </div>
        </header>

        <main className="music-lobby-main">
          <div className="music-lobby-grid">
            {/* Hero banner */}
            <div className="music-lobby-hero">
              <div className="music-lobby-hero-title">
                🎛 KMTI <span>Music Room</span>
                <span className={`music-eq-bars ${isPlaying ? 'playing' : ''}`} aria-hidden="true">
                  <span className="music-eq-bar" />
                  <span className="music-eq-bar" />
                  <span className="music-eq-bar" />
                  <span className="music-eq-bar" />
                  <span className="music-eq-bar" />
                </span>
              </div>
              <div className="music-lobby-hero-sub">synchronized_audio &bull; press Ctrl+Alt+M to toggle</div>
            </div>
            {/* Create Room Panel */}
            <div className="music-card music-create-card">
              <h3>Create a Music Room</h3>
              <p className="card-desc">Start a room as DJ and broadcast streams to other operators.</p>
              <form onSubmit={handleCreateRoom} className="music-form">
                <input
                  type="text"
                  placeholder="e.g. Developer Lofi Lounge"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="music-input"
                  maxLength={30}
                  required
                />
                <button type="submit" className="music-btn music-btn--primary">
                  Launch Room & DJ Deck
                </button>
              </form>
            </div>

            {/* Active Rooms list */}
            <div className="music-card music-rooms-card">
              <h3>Active Listening Rooms</h3>
              <div className="rooms-container">
                {rooms.length === 0 ? (
                  <div className="no-rooms">
                    <div className="no-rooms-icon">📡</div>
                    <p>No active rooms. Be the first to start a deck!</p>
                  </div>
                ) : (
                  rooms.map((r) => (
                    <div key={r.id} className="room-item">
                      <div className="room-item-info">
                        <div className="room-name">{r.displayName}</div>
                        <div className="room-details">
                          <span>DJ: {r.djName}</span> ·{' '}
                          <span>
                            {r.isPlaying ? `🔊 Playing: ${r.trackTitle || 'Audio stream'}` : '🔇 Paused'}
                          </span>
                        </div>
                      </div>
                      <div className="room-item-action">
                        <span className="room-listeners-badge">
                          👤 {r.listenerCount}
                        </span>
                        <button
                          onClick={() => joinRoom(r.id)}
                          className="music-btn music-btn--secondary"
                        >
                          Join Along
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Active room view
  return (
    <div className="music-page">
      <div className="music-scanlines" aria-hidden="true" />
      
      <header className="music-header">
        <div className="music-header-left">
          <div className="music-terminal-bar">
            <span className="music-dot music-dot--red" />
            <span className="music-dot music-dot--yellow" />
            <span className="music-dot music-dot--green" />
            <span className="music-terminal-title">kmti_workstation // deck://{activeRoom.id}</span>
          </div>
          <div className="music-room-title">
            Room: <strong>{activeRoom.displayName}</strong>
          </div>
        </div>
        <div className="music-header-right">
          <button onClick={leaveRoom} className="music-btn music-btn--danger">
            Leave Room
          </button>
        </div>
      </header>

      <main className="music-room-main">
        <div className="music-room-grid">
          {/* Deck Player */}
          <div className="music-card deck-card">
            <div className={`deck-visualizer ${isPlaying ? 'playing' : ''}`}>
              <AudioVisualizer isPlaying={isPlaying} size={180} />
              <div className="deck-track-info">
                <div className="now-playing-label">
                  NOW PLAYING
                  <span className={`deck-eq-bars ${isPlaying ? 'playing' : ''}`} aria-hidden="true">
                    <span className="deck-eq-bar" />
                    <span className="deck-eq-bar" />
                    <span className="deck-eq-bar" />
                    <span className="deck-eq-bar" />
                  </span>
                </div>
                <div className="track-title">{trackTitle || 'No stream active'}</div>
                <div className="track-url-display">{trackUrl || 'Waiting for DJ to start a track...'}</div>
                <div className="dj-badge-display">DJ: {activeRoom.djName} {isDj && '(You)'}</div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="deck-controls">
              {/* Playback timeline bar */}
              <div className="playback-bar-container">
                <span className="time-label">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seek(parseFloat(e.target.value))}
                  disabled={!isDj}
                  className="playback-slider"
                />
                <span className="time-label">
                  {duration && duration > 0 ? formatTime(duration) : 'Live'}
                </span>
              </div>

              {/* Master Control Buttons */}
              <div className="deck-buttons">
                <button
                  onClick={togglePlay}
                  className={`deck-play-btn ${isPlaying ? 'playing' : ''}`}
                  disabled={!isDj && !trackUrl}
                >
                  {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                </button>

                <div className="volume-controls">
                  <button onClick={toggleMute} className="mute-btn">
                    {isMuted || volume === 0 ? '🔇' : '🔊'}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="volume-slider"
                  />
                </div>
              </div>
            </div>

            {/* DJ Control Console (Only shown if DJ) */}
            {isDj && (
              <div className="dj-console">
                <h4 className="console-title">DJ CONTROL CONSOLE</h4>
                
                {/* Presets List */}
                <div className="presets-list">
                  <div className="console-sub-label">Radio &amp; Focus Streams:</div>
                  <div className="preset-buttons-grid">
                    {PRESET_STREAMS.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePlayPreset(p)}
                        className={`preset-btn ${trackUrl === p.url ? 'active' : ''}`}
                        title={p.desc}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom URL Input */}
                <form onSubmit={handlePlayCustom} className="custom-stream-form">
                  <div className="console-sub-label">Custom Audio Stream URL:</div>
                  <div className="input-group">
                    <input
                      type="text"
                      placeholder="Title (e.g. Synthwave)"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="music-input"
                    />
                    <input
                      type="url"
                      placeholder="https://example.com/stream.mp3"
                      value={customUrl}
                      onChange={(e) => { setCustomUrl(e.target.value); setUrlError('') }}
                      className={`music-input url-input ${urlError ? 'input-error' : ''}`}
                      required
                    />
                    <button type="submit" className="music-btn music-btn--primary">
                      Stream
                    </button>
                  </div>
                  {urlError ? (
                    <div className="url-error-msg">⚠️ {urlError}</div>
                  ) : (
                    <div className="url-hint">Direct .mp3 / .aac / radio stream URLs only — not YouTube or Spotify links.</div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Members Panel */}
          <div className="music-card members-card">
            <h3>Listeners ({listeners.length})</h3>
            <div className="listeners-list">
              {listeners.map((listener, index) => (
                <div key={index} className="listener-row">
                  <span className={`listener-avatar ${listener.isDj ? 'avatar-dj' : ''}`}>
                    {listener.isDj ? '🎧' : '👤'}
                  </span>
                  <div className="listener-name-group">
                    <span className="listener-name">{listener.name}</span>
                    {listener.isDj && <span className="dj-tag">DJ</span>}
                  </div>
                  <span className="listener-status-dot"></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
