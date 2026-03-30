import { useState, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const { login, isLoading, loginSucceeded } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  // Luxe low-density particles
  const [particles] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 5}s`,
      duration: `${20 + Math.random() * 20}s`,
      size: `${1 + Math.random() * 1.5}px`,
      id: i
    }))
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setShake(false)

    async function attemptLogin(retries = 3): Promise<void> {
      try {
        await login(username.trim(), password)
      } catch (err: any) {
        // If it's a fetch error, we might want to retry
        if (err.message === 'Failed to fetch' && retries > 0) {
          console.log(`>>> [LOGIN] Fetch failed, retrying... (${retries} left)`)
          await new Promise(resolve => setTimeout(resolve, 1500))
          return attemptLogin(retries - 1)
        }
        throw err
      }
    }

    try {
      await attemptLogin()
    } catch (err: any) {
      setError(err.message ?? 'Invalid credentials. Please try again.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  // Compute CSS classes for the card
  const cardClass = [
    'login-card',
    shake ? 'shake' : '',
    loginSucceeded ? 'exiting' : '',
  ].filter(Boolean).join(' ')

  // Reactive Specular Highlight
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setMousePos({ x, y })
  }

  return (
    <div className="login-page">
      <div className="login-bg-overlay"></div>

      <div
        className={cardClass}
        onMouseMove={handleMouseMove}
        style={{ '--mouse-x': `${mousePos.x}%`, '--mouse-y': `${mousePos.y}%` } as any}
      >
        <div className="particles-container">
          {particles.map(p => (
            <div
              key={p.id}
              className="particle"
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.duration,
                width: p.size,
                height: p.size,
                '--d': p.duration
              } as any}
            />
          ))}
        </div>

        {/* Technical HUD Elements */}
        <div className="hud-corner hud-tl"></div>
        <div className="hud-corner hud-tr"></div>
        <div className="hud-corner hud-bl"></div>
        <div className="hud-corner hud-br"></div>

        <div className="login-card-content">
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-group">
                <span className="logo-big">K</span>
                {/* <span className="logo-small">usakabe</span> */}
              </div>
              {/* <div className="logo-group symbol">&</div> */}
              <div className="logo-group">
                <span className="logo-big">M</span>
                {/* <span className="logo-small">aeno</span> */}
              </div>
              <div className="logo-group">
                <span className="logo-big">T</span>
                {/* <span className="logo-small">ech.,</span> */}
              </div>
              <div className="logo-group">
                <span className="logo-big">I</span>
                {/* <span className="logo-small">NC.</span> */}
              </div>
            </div>
            <h1 className="login-title">Workstation</h1>
            <p className="login-subtitle">Secure Data Management System</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>

            <div className="login-input-group">
              <label htmlFor="username">USERNAME</label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="password">PASSWORD</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              {error && <div className="login-input-error">{error}</div>}
            </div>

            <button className="login-submit-btn" type="submit" disabled={isLoading || !username || !password}>
              {isLoading ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <span>Verifying...</span>
                </div>
              ) : (
                'SIGN IN'
              )}
            </button>
          </form>

          <div className="login-footer">
            <div className="footer-main">
              <span className="version-tag">VER 3.0.0</span>
              <span className="copyright">© 2026 KMTI</span>
            </div>
            <div className="system-readout">
              <span className="readout-item">Uptime: 14h 22m</span>
              <span className="readout-item">Database: ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
