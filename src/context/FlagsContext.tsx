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

export interface FeatureFlags {
  maintenance_mode: boolean
  feature_closed: boolean

  purchased_parts_enabled: boolean
  character_search_enabled: boolean
  heat_treatment_enabled: boolean
  calculator_enabled: boolean
  quotation_enabled: boolean
  designers_enabled: boolean

  purchased_parts_maintenance: boolean
  character_search_maintenance: boolean
  heat_treatment_maintenance: boolean
  calculator_maintenance: boolean
  quotation_maintenance: boolean
  designers_maintenance: boolean

  [key: string]: boolean
}

interface FlagsContextValue {
  flags: FeatureFlags
  isLoading: boolean
  refresh: (background?: boolean) => Promise<void>
  setFlag: (key: string, value: boolean) => Promise<void>
}

const DEFAULT_FLAGS: FeatureFlags = {
  maintenance_mode: false,
  feature_closed: false,

  purchased_parts_enabled: true,
  character_search_enabled: true,
  heat_treatment_enabled: true,
  calculator_enabled: true,
  quotation_enabled: false,
  designers_enabled: true,

  purchased_parts_maintenance: false,
  character_search_maintenance: false,
  heat_treatment_maintenance: false,
  calculator_maintenance: false,
  quotation_maintenance: false,
  designers_maintenance: false,
}

const FlagsContext = createContext<FlagsContextValue | null>(null)

export function FlagsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async (background = false) => {
    if (!user) return
    if (!background) setIsLoading(true)
    try {
      const res = await flagsApi.getAll()
      setFlags({ ...DEFAULT_FLAGS, ...res })
    } catch {
      // Non-fatal: fall back to defaults if fetch fails
    } finally {
      if (!background) setIsLoading(false)
    }
  }, [user])

  // Fetch flags whenever user logs in and set up background polling
  useEffect(() => {
    refresh()
    
    // Dynamically poll backend every 10 seconds for real-time propagation across workstations
    const timer = setInterval(() => {
      refresh(true)
    }, 10000)
    
    return () => clearInterval(timer)
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
