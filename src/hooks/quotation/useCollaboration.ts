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
  quotNo: string | null
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
} {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [remoteUsers, setRemoteUsers] = useState<Record<string, RemoteUser>>({})
  const [myEffectiveName, setMyEffectiveName] = useState(userName || 'User')
  const [myColor, setMyColor] = useState('#4A90D9')
  const [mySessionId, setMySessionId] = useState('')
  const currentQuotRef = useRef<string | null>(null)
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
    if (!quotNo) return

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
      socket.emit('join_doc', { quot_no: quotNo, user_name: finalName, password, display_name: displayName || null })
      currentQuotRef.current = quotNo
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
      if (currentQuotRef.current && currentQuotRef.current !== quotNo) {
        socket.emit('leave_doc', { quot_no: currentQuotRef.current })
      }
      doJoin()
    }

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Server confirmed we joined and assigned our color
    socket.on('joined', (data: { sid: string; color: string; users: Record<string, RemoteUser> }) => {
      setMyColor(data.color)
      setMySessionId(data.sid)
      const others = { ...data.users }
      delete others[data.sid]
      setRemoteUsers(others)
    })

    socket.on('user_joined', (data: { sid: string; name: string; color: string; users: Record<string, RemoteUser> }) => {
      const newUser = { sid: data.sid, name: data.name, color: data.color }
      setRemoteUsers(prev => ({
        ...prev,
        [data.sid]: newUser,
      }))
      joinHandlerRef.current?.(newUser)
    })

    socket.on('user_left', (data: { sid: string }) => {
      setRemoteUsers(prev => {
        if (prev[data.sid]) {
          leftHandlerRef.current?.(prev[data.sid])
        }
        const next = { ...prev }
        delete next[data.sid]
        return next
      })
    })

    // Field focus/blur presence tracking
    socket.on('remote_focus', (data: { sid: string; field_key: string; name: string; color: string }) => {
      setRemoteUsers(prev => ({
        ...prev,
        [data.sid]: {
          ...(prev[data.sid] || { sid: data.sid, name: data.name, color: data.color }),
          focusedField: data.field_key,
        },
      }))
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

    return () => {
      if (currentQuotRef.current) {
        socket.emit('leave_doc', { quot_no: currentQuotRef.current })
      }
      socket.removeAllListeners()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotNo, userName])

  const emitFocus = useCallback((fieldKey: string) => {
    if (!socketRef.current || !currentQuotRef.current) return
    socketRef.current.emit('focus_field', { quot_no: currentQuotRef.current, field_key: fieldKey })
  }, [])

  const emitBlur = useCallback((fieldKey: string) => {
    if (!socketRef.current || !currentQuotRef.current) return
    socketRef.current.emit('blur_field', { quot_no: currentQuotRef.current, field_key: fieldKey })
  }, [])

  const emitSelection = useCallback((fieldKey: string, start: number, end: number) => {
    if (!socketRef.current || !currentQuotRef.current) return
    socketRef.current.emit('focus_selection', { 
      quot_no: currentQuotRef.current, 
      field_key: fieldKey,
      start,
      end
    })
  }, [])

  const emitPatch = useCallback((patch: { path: string; value: any }, fullState?: any) => {
    if (!socketRef.current || !currentQuotRef.current) return
    socketRef.current.emit('update_field', {
      quot_no: currentQuotRef.current,
      patch,
      full_state: fullState,
    })
  }, [])

  return { isConnected, remoteUsers, myEffectiveName, myColor, mySessionId, emitFocus, emitBlur, emitSelection, emitPatch }
}
