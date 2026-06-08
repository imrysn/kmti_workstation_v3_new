import { useLocation, useNavigate } from 'react-router-dom'
import { useMusic } from '../context/MusicContext'
import './MusicMiniPlayer.css'

export default function MusicMiniPlayer() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    activeRoom,
    isPlaying,
    volume,
    isMuted,
    trackTitle,
    isDj,
    togglePlay,
    setVolume,
    toggleMute,
    leaveRoom
  } = useMusic()

  // Hide the mini-player if we are not in a room, or if we are already on the Music Room page
  if (!activeRoom || location.pathname === '/music-room') {
    return null
  }

  return (
    <div className="music-mini-player no-print">
      <div className="mini-disc-container" onClick={() => navigate('/music-room')} title="Go to Music Room">
        <div className={`mini-vinyl ${isPlaying ? 'spinning' : ''}`}>
          <div className="mini-vinyl-center" />
        </div>
      </div>

      <div className="mini-track-details">
        <div className="mini-track-title" onClick={() => navigate('/music-room')} title={trackTitle || 'Audio stream'}>
          {trackTitle || 'Audio stream'}
        </div>
        <div className="mini-dj-name">DJ: {activeRoom.djName}</div>
      </div>

      <div className="mini-controls">
        {/* Play/Pause (DJs get control, listeners get local toggle/override) */}
        <button
          onClick={togglePlay}
          className={`mini-play-btn ${isPlaying ? 'playing' : ''}`}
          title={isDj ? (isPlaying ? 'Pause Broadcast' : 'Play Broadcast') : (isPlaying ? 'Mute/Pause' : 'Play')}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div className="mini-volume-group">
          <button onClick={toggleMute} className="mini-mute-btn" title="Toggle Mute">
            {isMuted || volume === 0 ? '🔇' : '🔊'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="mini-volume-slider"
          />
        </div>

        <button onClick={leaveRoom} className="mini-leave-btn" title="Leave Music Room">
          ❌
        </button>
      </div>
    </div>
  )
}
