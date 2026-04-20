/**
 * CollaborationContext.tsx
 * ─────────────────────────────────────────────────────────────────
 * Provides real-time collaboration tools (presence + remote updates)
 * to the Quotation module tree.
 */

import { createContext, useContext, ReactNode } from 'react'
import type { RemoteUser } from '../hooks/quotation/useCollaboration'

interface CollaborationContextValue {
  isConnected: boolean
  remoteUsers: Record<string, RemoteUser>
  myColor: string
  recentEdits: Record<string, { color: string; timestamp: number }>
  emitFocus: (fieldKey: string) => void
  emitBlur: (fieldKey: string) => void
  emitSelection: (fieldKey: string, start: number, end: number) => void
  emitPatch: (patch: { path: string; value: any }, fullState?: any) => void
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null)

export function CollaborationProvider({
  children,
  value
}: {
  children: ReactNode
  value: CollaborationContextValue
}) {
  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  )
}

export function useCollaborationContext() {
  const ctx = useContext(CollaborationContext)
  if (!ctx) {
    // Return a dummy value if used outside provider (e.g. initial render or modals)
    return {
      isConnected: false,
      remoteUsers: {},
      myColor: '#94a3b8',
      recentEdits: {},
      emitFocus: () => {},
      emitBlur: () => {},
      emitSelection: () => {},
      emitPatch: () => {},
    }
  }
  return ctx
}
