import { useState, FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const { login, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setShake(false)
    
    try {
      await login(username.trim(), password)
    } catch (err: any) {
      setError(err.message ?? 'Invalid credentials. Please try again.')
      setShake(true)
      // Reset shake after animation completes
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-overlay"></div>
      
      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-k">K</span>
            <span className="logo-m">M</span>
            <span className="logo-t">T</span>
            <span className="logo-i">I</span>
          </div>
          <h1 className="login-title">Workstation V3</h1>
          <p className="login-subtitle">Secure Data Management Systems</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error-container">
              <svg className="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="login-input-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="login-input-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <button className="login-submit-btn" type="submit" disabled={isLoading || !username || !password}>
            {isLoading ? (
              <span className="loader-container">
                <span className="spinner"></span>
                Authenticating...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <span className="version-tag">Build 3.0.42</span>
          <span className="copyright">© 2026 KMTI Tech</span>
        </div>
      </div>
    </div>
  )
}
