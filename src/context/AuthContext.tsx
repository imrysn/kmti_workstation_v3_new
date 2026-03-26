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
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      // OAuth2PasswordRequestForm requires application/x-www-form-urlencoded
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
      setToken(data.access_token)

      // 1. Signal login card to play its exit animation
      setLoginSucceeded(true)

      // 2. Wait for exit animation (~400ms), then resize the window
      await new Promise(resolve => setTimeout(resolve, 380))
      ;(window as any).electronAPI?.loginSuccess?.()

      // 3. Brief pause for Electron to maximize, then switch the render tree
      await new Promise(resolve => setTimeout(resolve, 120))
      setUser(data.user)
      setLoginSucceeded(false)   // reset so the card is visible on next logout→login
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    // 1. Trigger workstation fade-out animation
    setIsLoggingOut(true)

    // 2. Wait for the fade-out CSS animation
    await new Promise(resolve => setTimeout(resolve, 320))

    // 3. Signal Electron to shrink the window back to login panel
    ;(window as any).electronAPI?.logoutReset?.()

    // 4. Brief pause for Electron to resize, then clear auth state
    await new Promise(resolve => setTimeout(resolve, 120))
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

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginSucceeded, isLoggingOut, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
