/**
 * useCollaboration.ts
 * ─────────────────────────────────────────────────────────────────
 * Manages the Socket.IO connection for real-time quotation collaboration.
 * Tracks remote user presence (field focus + color identifiers).
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { SERVER_BASE } from '../../services/api'

export interface RemoteUser {
  sid: string
  name: string
  color: string
  focusedField?: string
  selection?: { start: number; end: number } | null
}

export interface CollaborationState {
  isConnected: boolean
  remoteUsers: Record<string, RemoteUser>
  myEffectiveName: string
  myColor: string
  mySessionId: string
}

interface UseCollaborationOptions {
  quotId: number | null
  quotNo?: string | null
  password?: string
  displayName?: string   // Human-readable label shown in the sessions list
  userName?: string // Fallback, but computer name takes priority
  onRemotePatch?: (patch: { path: string; value: any }, sid: string) => void
  onAuditEntry?: (entry: any) => void
  onUserJoined?: (user: RemoteUser) => void
  onUserLeft?: (user: RemoteUser) => void
  onError?: (message: string) => void
}

export function useCollaboration({
  quotId,
  quotNo,
  password,
  displayName,
  userName,
  onRemotePatch,
  onAuditEntry,
  onUserJoined,
  onUserLeft,
  onError,
}: UseCollaborationOptions): CollaborationState & {
  emitFocus: (fieldKey: string) => void
  emitBlur: (fieldKey: string) => void
  emitSelection: (fieldKey: string, start: number, end: number) => void
  emitPatch: (patch: { path: string; value: any }, fullState?: any) => void
  emitSnapshot: (fullState: any, label?: string) => void
  leaveRoom: () => void
} {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({})
  const [myEffectiveName, setMyEffectiveName] = useState(userName || 'User')
  const [myColor, setMyColor] = useState('#4A90D9')
  const [mySessionId, setMySessionId] = useState('')
  const currentQuotIdRef = useRef<number | null>(null)
  const patchHandlerRef = useRef(onRemotePatch)
  const auditHandlerRef = useRef(onAuditEntry)

  // Keep references to latest callbacks to avoid stale closures in socket listeners
  useEffect(() => {
    patchHandlerRef.current = onRemotePatch
    auditHandlerRef.current = onAuditEntry
  }, [onRemotePatch, onAuditEntry])

  const joinHandlerRef = useRef(onUserJoined)
  const leftHandlerRef = useRef(onUserLeft)
  useEffect(() => {
    joinHandlerRef.current = onUserJoined
    leftHandlerRef.current = onUserLeft
  }, [onUserJoined, onUserLeft])

  const errorHandlerRef = useRef(onError)
  useEffect(() => {
    errorHandlerRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!quotId) return

    // Clear stale presence from previous room immediately — don't wait for server
    setRemoteUsers({})
    setIsConnected(false)

    // Create or reuse socket — connect to SERVER_BASE with the custom mount path
    if (!socketRef.current) {
      socketRef.current = io(SERVER_BASE, {
        path: '/socket.io',           // matches socketio.ASGIApp wrapping at root in FastAPI
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
      })
    }
    const socket = socketRef.current

    // If already connected (room switch), emit join immediately without waiting for 'connect'
    const doJoin = async () => {
      let finalName = userName || 'Unknown'
      try {
        const info = await (window as any).electronAPI?.getWorkstationInfo?.()
        if (info?.computerName) finalName = info.computerName
      } catch (e) {
        console.warn('[collaboration] Failed to fetch workstation info:', e)
      }
      setMyEffectiveName(finalName)
      socket.emit('join_doc', { 
        quot_id: quotId, 
        quot_no: quotNo, // Sent as fallback/metadata
        user_name: finalName, 
        password, 
        display_name: displayName || null 
      })
      currentQuotIdRef.current = quotId
    }

    socket.on('connect', async () => {
      setIsConnected(true)
      setMySessionId(socket.id || '')
      await doJoin()
    })

    // Socket already connected from a previous room — switch rooms immediately
    if (socket.connected) {
      setIsConnected(true)
      setMySessionId(socket.id || '')
      if (currentQuotIdRef.current && currentQuotIdRef.current !== quotId) {
        socket.emit('leave_doc', { quot_id: currentQuotIdRef.current })
      }
      doJoin()
    }

    socket.on('connect_error', (err) => {
      console.error('[collaboration] Connection Error:', err.message, 'URL:', SERVER_BASE)
      setIsConnected(false)
    })

    socket.on('reconnect_attempt', (num) => {
      console.log(`[collaboration] Reconnect attempt #${num}...`)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[collaboration] Disconnected:', reason)
      setIsConnected(false)
    })

    // Server confirmed we joined and assigned our color
    socket.on('joined', (data: { sid: string; color: string; users: Record<string, any> }) => {
      setMyColor(data.color)
      setMySessionId(data.sid)
      
      const others: Record<string, RemoteUser> = {}
      Object.entries(data.users).forEach(([sid, u]) => {
        if (sid !== data.sid) {
          others[sid] = { ...u, sid }
        }
      })
      setRemoteUsers(others)
    })

    socket.on('user_joined', (data: { sid: string; name: string; color: string; users: Record<string, any> }) => {
      const newUser = { sid: data.sid, name: data.name, color: data.color }
      setRemoteUsers(prev => {
        const next: Record<string, RemoteUser> = {}
        Object.entries(data.users).forEach(([sid, u]) => {
          if (sid !== socket.id) {
            next[sid] = {
              ...(prev[sid] || {}), // preserve focusedField, selection, etc.
              ...u,
              sid
            }
          }
        })
        return next
      })
      joinHandlerRef.current?.(newUser)
    })

    socket.on('user_left', (data: { sid: string; users: Record<string, any> }) => {
      setRemoteUsers(prev => {
        if (prev[data.sid]) {
          leftHandlerRef.current?.(prev[data.sid])
        }
        const next: Record<string, RemoteUser> = {}
        // Purge ghosts by only keeping users present in the server's list
        if (data.users) {
          Object.entries(data.users).forEach(([sid, u]) => {
            if (sid !== socket.id) {
              next[sid] = {
                ...(prev[sid] || {}),
                ...u,
                sid
              }
            }
          })
        }
        return next
      })
    })

    // Field focus/blur presence tracking
    socket.on('remote_focus', (data: { sid: string; field_key: string; name: string; color: string }) => {
      setRemoteUsers(prev => {
        const u = prev[data.sid] || { sid: data.sid }
        return {
          ...prev,
          [data.sid]: {
            ...u,
            name: data.name || u.name || 'Unknown',
            color: data.color || u.color || '#4A90D9',
            focusedField: data.field_key,
          },
        }
      })
    })

    socket.on('remote_blur', (data: { sid: string; field_key: string }) => {
      setRemoteUsers(prev => {
        if (!prev[data.sid]) return prev
        const user = { ...prev[data.sid] }
        if (user.focusedField === data.field_key) {
          delete user.focusedField
          delete user.selection
        }
        return { ...prev, [data.sid]: user }
      })
    })

    socket.on('remote_selection', (data: { sid: string; field_key: string; start: number; end: number }) => {
      setRemoteUsers(prev => {
        if (!prev[data.sid]) return prev
        return {
          ...prev,
          [data.sid]: { 
            ...prev[data.sid], 
            focusedField: data.field_key,
            selection: { start: data.start, end: data.end } 
          }
        }
      })
    })

    // Incoming state patches from other users
    socket.on('remote_patch', (data: { sid: string; patch: { path: string; value: any } }) => {
      patchHandlerRef.current?.(data.patch, data.sid)
    })

    // Incoming audit log updates
    socket.on('audit_entry', (entry: any) => {
      auditHandlerRef.current?.(entry)
    })

    socket.on('join_error', (err: { message: string }) => {
      errorHandlerRef.current?.(err.message)
    })

    socket.on('history_updated', () => {
      // Small delay to ensure DB is written before sidebar refetches
      setTimeout(() => {
        const sidebar = document.querySelector('.history-sidebar')
        if (sidebar) {
          // Internal event for HistorySidebar to pick up
          window.dispatchEvent(new CustomEvent('quot:history-refresh', { detail: { quotId } }))
        }
      }, 500)
    })

    return () => {
      // We DO NOT emit 'leave_doc' here anymore. 
      // This allows the user to navigate to other pages in the app 
      // without being removed from the collaborative workspace.
      socket.removeAllListeners()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotId, userName])

  const leaveRoom = useCallback(() => {
    if (socketRef.current && currentQuotIdRef.current) {
      socketRef.current.emit('leave_doc', { quot_id: currentQuotIdRef.current })
      // Also clear in-memory state
      currentQuotIdRef.current = null
      setRemoteUsers({})
      setIsConnected(false)
    }
  }, [])

  const emitFocus = useCallback((fieldKey: string) => {
    if (!socketRef.current || !currentQuotIdRef.current) return
    socketRef.current.emit('focus_field', { quot_id: currentQuotIdRef.current, field_key: fieldKey })
  }, [])

  const emitBlur = useCallback((fieldKey: string) => {
    if (!socketRef.current || !currentQuotIdRef.current) return
    socketRef.current.emit('blur_field', { quot_id: currentQuotIdRef.current, field_key: fieldKey })
  }, [])

  const emitSelection = useCallback((fieldKey: string, start: number, end: number) => {
    if (!socketRef.current || !currentQuotIdRef.current) return
    socketRef.current.emit('focus_selection', { 
      quot_id: currentQuotIdRef.current, 
      field_key: fieldKey,
      start,
      end
    })
  }, [])

  const emitPatch = useCallback((patch: { path: string; value: any }, fullState?: any) => {
    if (!socketRef.current || !currentQuotIdRef.current) return
    socketRef.current.emit('update_field', {
      quot_id: currentQuotIdRef.current,
      patch,
      full_state: fullState,
    })
  }, [])

  const emitSnapshot = useCallback((fullState: any, label?: string) => {
    if (!socketRef.current || !currentQuotIdRef.current) return
    socketRef.current.emit('trigger_snapshot', {
      quot_id: currentQuotIdRef.current,
      full_state: fullState,
      label,
    })
  }, [])

  return { 
    isConnected, 
    remoteUsers, 
    myEffectiveName, 
    myColor, 
    mySessionId, 
    emitFocus, 
    emitBlur, 
    emitSelection, 
    emitPatch, 
    emitSnapshot,
    leaveRoom
  }
}
