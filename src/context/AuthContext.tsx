/**
 * AuthContext — central auth state for the entire app.
 *
 * - Token lives in memory only (no localStorage, no disk).
 *   App restart = re-login. Intentional for a shared workstation.
 * - Exposes: user, token, login(), logout(), hasRole(), isLoading
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react'

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
    const saved = localStorage.getItem('kmti_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(localStorage.getItem('kmti_token'))
  const [isLoading, setIsLoading] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const body = new URLSearchParams()
      body.append('username', username)
      body.append('password', password)

      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
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
      localStorage.setItem('kmti_token', data.access_token)
      localStorage.setItem('kmti_user', JSON.stringify(data.user))
      
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
    localStorage.removeItem('kmti_token')
    localStorage.removeItem('kmti_user')
    
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
