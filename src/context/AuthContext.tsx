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
import { API_BASE, settingsApi } from '../services/api'

export type UserRole = 'user' | 'admin' | 'it'

export interface AuthUser {
  id: number
  username: string
  fullName: string
  displayName?: string
  role: UserRole
}

async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  loginSucceeded: boolean
  isLoggingOut: boolean
  sessionExpired: boolean
  isOfflineMode: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  dismissSessionExpired: () => void
  triggerSessionExpired: () => void
  hasRole: (...roles: UserRole[]) => boolean
  setDisplayName: (name: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = sessionStorage.getItem('kmti_user')
    if (!saved) return null
    try {
      const u = JSON.parse(saved)
      return u && u.username ? u : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('kmti_token')
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [loginSucceeded, setLoginSucceeded] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [hasRestored, setHasRestored] = useState(false)

  const [isOfflineMode, setIsOfflineMode] = useState(false)

  // Sync isOfflineMode with server-status dot
  useEffect(() => {
    const handleServerStatus = (e: Event) => {
      const customEvent = e as CustomEvent
      setIsOfflineMode(!customEvent.detail?.online)
    }
    window.addEventListener('kmti:server-status', handleServerStatus)
    return () => window.removeEventListener('kmti:server-status', handleServerStatus)
  }, [])

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
    const normalizedUsername = username.toLowerCase().trim()
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
      sessionStorage.removeItem('kmti_landing_agenda_shown')
      localStorage.removeItem('kmti_suppress_agenda_date')
      
      // Cache last successful credentials/user for offline login
      try {
        const passHash = await hashPassword(password)
        const offlineCache = {
          username: normalizedUsername,
          passHash,
          user: data.user,
          token: data.access_token,
        }
        localStorage.setItem(`kmti_offline_cache_${normalizedUsername}`, JSON.stringify(offlineCache))
        
        // Trigger preloading in the background
        const { preloadOfflineCache } = await import('../services/api')
        preloadOfflineCache().catch(() => {})
      } catch (e) {
        console.error('Failed to cache credentials for offline use', e)
      }

      setToken(data.access_token)
      setIsOfflineMode(false)

      setLoginSucceeded(true)
      await new Promise(resolve => setTimeout(resolve, 380))
      
      ;(window as any).electronAPI?.loginSuccess?.()
      
      await new Promise(resolve => setTimeout(resolve, 120))
      setUser(data.user)
      setLoginSucceeded(false)
    } catch (err: any) {
      // If server is down, try offline authentication
      const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError'
      if (isNetworkError) {
        const cachedStr = localStorage.getItem(`kmti_offline_cache_${normalizedUsername}`)
        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr)
            const passHash = await hashPassword(password)
            if (cached.passHash === passHash) {
              // Success! Offline login
              sessionStorage.setItem('kmti_token', cached.token)
              sessionStorage.setItem('kmti_user', JSON.stringify(cached.user))
              sessionStorage.removeItem('kmti_landing_agenda_shown')
              localStorage.removeItem('kmti_suppress_agenda_date')

              setToken(cached.token)
              setIsOfflineMode(true)

              setLoginSucceeded(true)
              await new Promise(resolve => setTimeout(resolve, 380))
              ;(window as any).electronAPI?.loginSuccess?.()
              await new Promise(resolve => setTimeout(resolve, 120))
              setUser(cached.user)
              setLoginSucceeded(false)
              return
            } else {
              throw new Error('Incorrect password. Offline credentials do not match.')
            }
          } catch (e: any) {
            console.error('Failed to authenticate offline', e)
            throw new Error(e.message || 'Failed to authenticate offline')
          }
        } else {
          throw new Error('No offline login cache found for this user. You must sign in online at least once.')
        }
      }
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setDisplayName = useCallback((name: string) => {
    if (!user) return
    const trimmed = name.trim()
    const updatedUser = { ...user }
    if (trimmed) {
      updatedUser.displayName = trimmed
    } else {
      delete updatedUser.displayName
    }
    setUser(updatedUser)
    sessionStorage.setItem('kmti_user', JSON.stringify(updatedUser))
    // Persist to backend (non-blocking)
    settingsApi.updateDisplayName(trimmed).catch(() => {})
  }, [user])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    await new Promise(resolve => setTimeout(resolve, 320))

    ;(window as any).electronAPI?.logoutReset?.()

    await new Promise(resolve => setTimeout(resolve, 120))
    
    // Clear persistence
    sessionStorage.removeItem('kmti_token')
    sessionStorage.removeItem('kmti_user')
    sessionStorage.removeItem('kmti_landing_agenda_shown')
    localStorage.removeItem('kmti_suppress_agenda_date')
    
    // Clear all quot:* namespace keys (STOR-01)
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.startsWith('quot:')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k))
    } catch {
      // ignore
    }
    
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
      sessionExpired, isOfflineMode,
      login, logout,
      dismissSessionExpired,
      triggerSessionExpired: () => setSessionExpired(true),
      hasRole,
      setDisplayName
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
