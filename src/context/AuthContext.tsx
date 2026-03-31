/**
 * AuthContext — central auth state for the entire app.
 *
 * - Token and user are persisted in localStorage for session continuity.
 *   On app restart, the session is automatically restored and the window
 *   is resized to the full workstation shell.
 * - Exposes: user, token, login(), logout(), hasRole(), isLoading
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { API_BASE } from '../services/api'

export type UserRole = 'user' | 'admin' | 'it'

export interface AuthUser {
  id: number
  username: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  loginSucceeded: boolean
  isLoggingOut: boolean
  sessionExpired: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  dismissSessionExpired: () => void
  triggerSessionExpired: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = sessionStorage.getItem('kmti_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(sessionStorage.getItem('kmti_token'))
  const [isLoading, setIsLoading] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [hasRestored, setHasRestored] = useState(false)

  // Trigger login-success only after explicit user login
  useEffect(() => {
    if (user && token && !hasRestored) {
      setHasRestored(true)
      // Small delay to ensure Electron is ready/stable
      setTimeout(() => {
        ;(window as any).electronAPI?.loginSuccess?.()
      }, 500)
    }
  }, [user, token, hasRestored])

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const body = new URLSearchParams()
      body.append('username', username)
      body.append('password', password)

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Login failed. Check your credentials.')
      }

      const data = await res.json()
      
      // Save for persistence
      sessionStorage.setItem('kmti_token', data.access_token)
      sessionStorage.setItem('kmti_user', JSON.stringify(data.user))
      
      setToken(data.access_token)

      setLoginSucceeded(true)
      await new Promise(resolve => setTimeout(resolve, 380))
      
      ;(window as any).electronAPI?.loginSuccess?.()
      
      await new Promise(resolve => setTimeout(resolve, 120))
      setUser(data.user)
      setLoginSucceeded(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 320))

    ;(window as any).electronAPI?.logoutReset?.()

    await new Promise(resolve => setTimeout(resolve, 120))
    
    // Clear persistence
    sessionStorage.removeItem('kmti_token')
    sessionStorage.removeItem('kmti_user')
    
    setToken(null)
    setUser(null)
    setIsLoggingOut(false)
  }, [])

  /**
   * Returns true if the current user has ANY of the provided roles.
   * Usage: hasRole('admin', 'it')
   */
  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false
      return roles.includes(user.role)
    },
    [user]
  )

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false)
    logout()
  }, [logout])

  return (
    <AuthContext.Provider value={{
      user, token, isLoading, loginSucceeded, isLoggingOut,
      sessionExpired,
      login, logout,
      dismissSessionExpired,
      triggerSessionExpired: () => setSessionExpired(true),
      hasRole
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
