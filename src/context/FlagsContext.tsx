/**
 * FeatureFlagsContext — reads IT-controlled feature flags from the shared DB.
 *
 * Flags are fetched once on login and cached in memory.
 * IT users get a refresh button; for all others flags update on next login.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { flagsApi } from '../services/api'
import { useAuth } from './AuthContext'

interface FeatureFlags {
  heat_treatment_enabled: boolean
  calculator_enabled: boolean
  maintenance_mode: boolean
  [key: string]: boolean
}

interface FlagsContextValue {
  flags: FeatureFlags
  isLoading: boolean
  refresh: () => Promise<void>
  setFlag: (key: string, value: boolean) => Promise<void>
}

const DEFAULT_FLAGS: FeatureFlags = {
  heat_treatment_enabled: true,
  calculator_enabled: true,
  maintenance_mode: false,
}

const FlagsContext = createContext<FlagsContextValue | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const res = await flagsApi.getAll()
      setFlags({ ...DEFAULT_FLAGS, ...res.data })
    } catch {
      // Non-fatal: fall back to defaults if fetch fails
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Fetch flags whenever user logs in
  useEffect(() => {
    refresh()
  }, [refresh])

  const setFlag = useCallback(async (key: string, value: boolean) => {
    await flagsApi.update(key, value)
    setFlags((prev) => ({ ...prev, [key]: value }))
  }, [])

  return (
    <FlagsContext.Provider value={{ flags, isLoading, refresh, setFlag }}>
      {children}
    </FlagsContext.Provider>
  )
}

export function useFlags(): FlagsContextValue {
  const ctx = useContext(FlagsContext)
  if (!ctx) throw new Error('useFlags must be used inside <FlagsProvider>')
  return ctx
}
